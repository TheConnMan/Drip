import { log } from "./index";

interface PerplexityResponse {
  id: string;
  model: string;
  created: number;
  citations?: string[];
  choices: Array<{
    index: number;
    finish_reason: string;
    message: {
      role: string;
      content: string;
    };
  }>;
}

export interface Citation {
  id: number;
  url: string;
  domain: string;
}

interface DeepResearchResult {
  content: string;
  citations: Citation[];
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return url;
  }
}

export async function conductDeepResearch(topic: string): Promise<DeepResearchResult> {
  if (process.env.SKIP_RESEARCH) {
    log("Skipping Perplexity research (SKIP_RESEARCH enabled), simulating 20s delay", "perplexity");
    await new Promise(resolve => setTimeout(resolve, 20000));
    return { content: "", citations: [] };
  }

  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error("PERPLEXITY_API_KEY environment variable is not set");
  }

  log(`Starting deep research for topic: ${topic}`, "perplexity");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout

  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-deep-research",
        messages: [
          {
            role: "user",
            content: `Research the following topic thoroughly and provide comprehensive information that would be useful for creating an educational course: ${topic}`,
          },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      log(`Perplexity API error: ${response.status} - ${errorText}`, "perplexity");
      throw new Error(`Perplexity API returned ${response.status}: ${errorText}`);
    }

    const data: PerplexityResponse = await response.json();

    const content = data.choices[0]?.message?.content || "";
    const citations: Citation[] = (data.citations || []).map((url, index) => ({
      id: index + 1,
      url,
      domain: extractDomain(url),
    }));

    log(`Deep research completed with ${citations.length} citations`, "perplexity");

    return { content, citations };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      log("Deep research timed out after 5 minutes", "perplexity");
      throw new Error("Deep research request timed out after 5 minutes");
    }

    log(`Deep research failed: ${error instanceof Error ? error.message : String(error)}`, "perplexity");
    throw error;
  }
}
