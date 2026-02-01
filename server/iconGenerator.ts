import Anthropic from "@anthropic-ai/sdk";
import { uploadImage, getImagePublicUrl } from "./objectStorage";

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
    model: "claude-3-5-haiku-20241022",
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
 * Generates an image using GPT Image 1 (gpt-image-1)
 */
async function generateImage(prompt: string): Promise<Buffer> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
        quality: "low",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    // GPT Image 1 returns base64 data
    if (data.data?.[0]?.b64_json) {
      return Buffer.from(data.data[0].b64_json, "base64");
    }

    // Fallback: if URL is returned, fetch it
    if (data.data?.[0]?.url) {
      const imageResponse = await fetch(data.data[0].url);
      const arrayBuffer = await imageResponse.arrayBuffer();
      return Buffer.from(arrayBuffer);
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

export interface IconGenerationResult {
  iconUrl: string;
  iconGeneratedAt: Date;
}

/**
 * Generates a course icon and uploads it to storage
 * Returns the public URL of the icon
 */
export async function generateCourseIcon(
  courseId: number,
  title: string,
  description: string
): Promise<IconGenerationResult> {
  console.log(`[icon-generator] Starting icon generation for course ${courseId}`);

  // Step 1: Generate the image prompt using Claude
  const imagePrompt = await generateImagePrompt(title, description || title);
  console.log(`[icon-generator] Generated prompt: ${imagePrompt.substring(0, 100)}...`);

  // Step 2: Generate the image using GPT Image 1
  const imageBuffer = await generateImage(imagePrompt);
  console.log(`[icon-generator] Generated image: ${imageBuffer.length} bytes`);

  // Step 3: Upload to object storage
  const storageKey = `courses/${courseId}/icon.png`;
  await uploadImage(storageKey, imageBuffer);
  console.log(`[icon-generator] Uploaded to ${storageKey}`);

  // Step 4: Get the public URL
  const iconUrl = await getImagePublicUrl(storageKey);
  const iconGeneratedAt = new Date();

  console.log(`[icon-generator] Icon ready at ${iconUrl}`);

  return { iconUrl, iconGeneratedAt };
}

/**
 * Safely generates a course icon, returning null on failure
 * Does not throw - logs errors and returns null
 */
export async function generateCourseIconSafe(
  courseId: number,
  title: string,
  description: string
): Promise<IconGenerationResult | null> {
  try {
    return await generateCourseIcon(courseId, title, description);
  } catch (error) {
    console.error(`[icon-generator] Failed to generate icon for course ${courseId}:`, error);
    return null;
  }
}
