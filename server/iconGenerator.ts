import Anthropic from "@anthropic-ai/sdk";
import { uploadImage, imageExists } from "./objectStorage";
import { storage } from "./storage";

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

const ICON_PROMPT_SYSTEM = `You generate image prompts for course icons. Given a course title and description, output ONLY the image generation prompt with no other text.

Rules:
- Identify the single most visual, concrete symbol that represents the course topic
- Prefer physical objects over abstract concepts
- Avoid text, letters, or numbers in the icon
- Keep the symbol simple enough to read at 48x48 pixels

Output format (fill in the [SYMBOL] only):

Minimalist icon of a [SYMBOL], single simple shape, teal/cyan outline on dark charcoal background (#1E1E1E), no fill, no shading, no text, no gradients, centered composition, flat vector style, clean uniform line weight`;

/**
 * Generates an image prompt for a course icon using Claude Haiku
 */
async function generateImagePrompt(title: string, description: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 150,
    system: ICON_PROMPT_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Title: ${title}\nDescription: ${description}`,
      },
    ],
  });

  if (response.content[0].type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  return response.content[0].text.trim();
}

/**
 * Generates an image using DALL-E 3
 */
async function generateImage(prompt: string): Promise<Buffer> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout for DALL-E 3

  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
        quality: "hd",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    // DALL-E 3 returns a URL
    if (data.data?.[0]?.url) {
      const imageResponse = await fetch(data.data[0].url);
      const arrayBuffer = await imageResponse.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    // Fallback: if base64 is returned
    if (data.data?.[0]?.b64_json) {
      return Buffer.from(data.data[0].b64_json, "base64");
    }

    throw new Error("No image data in OpenAI response");
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Image generation timed out");
    }
    throw error;
  }
}

/**
 * Generates a course icon and uploads it to storage
 * Icon is served via /icon/:uuid.png endpoint using course rssFeedUuid
 */
export async function generateCourseIcon(
  courseId: number,
  title: string,
  description: string
): Promise<void> {
  console.log(`[icon-generator] Starting icon generation for course ${courseId}`);

  // Step 1: Generate the image prompt using Claude
  const imagePrompt = await generateImagePrompt(title, description || title);
  console.log(`[icon-generator] Generated prompt: ${imagePrompt.substring(0, 100)}...`);

  // Step 2: Generate the image using DALL-E 3
  const imageBuffer = await generateImage(imagePrompt);
  console.log(`[icon-generator] Generated image: ${imageBuffer.length} bytes`);

  // Step 3: Upload to object storage
  const storageKey = `courses/${courseId}/icon.png`;
  await uploadImage(storageKey, imageBuffer);
  console.log(`[icon-generator] Icon ready for course ${courseId}`);
}

/**
 * Safely generates a course icon, returning success/failure
 * Does not throw - logs errors and returns false
 */
export async function generateCourseIconSafe(
  courseId: number,
  title: string,
  description: string
): Promise<boolean> {
  try {
    await generateCourseIcon(courseId, title, description);
    return true;
  } catch (error) {
    console.error(`[icon-generator] Failed to generate icon for course ${courseId}:`, error);
    return false;
  }
}

/**
 * Backfills icons for all courses that don't have one
 * Checks file existence in storage rather than DB column
 * Runs in background and processes courses sequentially to avoid rate limits
 */
export async function backfillCourseIcons(): Promise<void> {
  const allCourses = await storage.getAllCourses();

  // Filter to courses that don't have icons in storage
  const coursesNeedingIcons = [];
  for (const course of allCourses) {
    const storageKey = `courses/${course.id}/icon.png`;
    const hasIcon = await imageExists(storageKey);
    if (!hasIcon) {
      coursesNeedingIcons.push(course);
    }
  }

  if (coursesNeedingIcons.length === 0) {
    console.log("[icon-generator] No courses need icon backfill");
    return;
  }

  console.log(`[icon-generator] Starting backfill for ${coursesNeedingIcons.length} courses`);

  for (const course of coursesNeedingIcons) {
    console.log(`[icon-generator] Backfilling icon for course ${course.id}: ${course.title}`);

    const success = await generateCourseIconSafe(
      course.id,
      course.title,
      course.description || ""
    );

    if (success) {
      console.log(`[icon-generator] Backfill complete for course ${course.id}`);
    }

    // Small delay between generations to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log("[icon-generator] Backfill complete");
}
