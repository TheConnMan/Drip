/**
 * Perplexity API Client
 * Handles deep research queries using sonar-deep-research model
 */

import type { Citation } from "../shared/schema";

const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";
const DEEP_RESEARCH_MODEL = "sonar-deep-research";
const RESEARCH_TIMEOUT_MS = 300_000; // 5 minute timeout for deep research

export interface ResearchQuery {
  topic: string;
  courseTitle: string;
  courseDescription: string;
  sessionTitles: string[];
}

export interface ResearchResult {
  content: string;
  citations: Citation[];
  searchCount: number;
  tokenCount: number;
}

interface PerplexityMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface PerplexityCitation {
  title?: string;
  url: string;
  snippet?: string;
}

interface PerplexityResponse {
  id: string;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  citations?: PerplexityCitation[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class PerplexityError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public isTimeout: boolean = false
  ) {
    super(message);
    this.name = "PerplexityError";
  }
}

/**
 * Constructs the research query from course context
 */
function buildResearchPrompt(query: ResearchQuery): string {
  const sessionList = query.sessionTitles
    .map((title, i) => `${i + 1}. ${title}`)
    .join("\n");

  return `Provide comprehensive research for an educational course on: "${query.topic}"

Course Title: ${query.courseTitle}
Course Description: ${query.courseDescription}

The course will cover these topics:
${sessionList}

Please provide thorough, well-cited research that includes:

1. **Current State of Knowledge**: What are the foundational concepts and latest understanding of this topic?

2. **Key Debates and Perspectives**: What are the main schools of thought or ongoing debates in this field?

3. **Recent Developments**: What significant developments have occurred in the last 2 years?

4. **Statistics and Data**: What are the key statistics, studies, or empirical findings relevant to this topic?

5. **Expert Opinions**: Who are the notable experts and what are their key insights?

6. **Practical Applications**: What are real-world examples and practical applications?

7. **Common Misconceptions**: What are common misunderstandings that learners should be aware of?

8. **Recommended Sources**: What are the best resources for further learning?

This research will be used to ground the course content in accurate, current, and citable information. Please be thorough and cite your sources.`;
}

/**
 * Normalizes Perplexity citations to our internal format
 */
function normalizeCitations(citations: PerplexityCitation[] | undefined): Citation[] {
  if (!citations || citations.length === 0) {
    return [];
  }

  return citations.map((citation, index) => {
    let domain = "";
    try {
      const url = new URL(citation.url);
      domain = url.hostname.replace(/^www\./, "");
    } catch {
      domain = citation.url;
    }

    return {
      index: index + 1, // 1-indexed for [1], [2] notation
      title: citation.title || `Source ${index + 1}`,
      url: citation.url,
      domain,
      snippet: citation.snippet || "",
    };
  });
}

/**
 * Performs deep research on a topic using Perplexity's sonar-deep-research model
 */
export async function performDeepResearch(query: ResearchQuery): Promise<ResearchResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY;

  if (!apiKey) {
    throw new PerplexityError("PERPLEXITY_API_KEY is not configured");
  }

  const prompt = buildResearchPrompt(query);

  const messages: PerplexityMessage[] = [
    {
      role: "user",
      content: prompt,
    },
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RESEARCH_TIMEOUT_MS);

  try {
    const response = await fetch(PERPLEXITY_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: DEEP_RESEARCH_MODEL,
        messages,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new PerplexityError(
        `Perplexity API error: ${errorText}`,
        response.status
      );
    }

    const data = (await response.json()) as PerplexityResponse;

    if (!data.choices || data.choices.length === 0) {
      throw new PerplexityError("No response from Perplexity API");
    }

    const content = data.choices[0].message.content;
    const citations = normalizeCitations(data.citations);

    // Estimate search count from citations if not provided
    const searchCount = data.citations?.length ?? 0;
    const tokenCount = data.usage?.total_tokens ?? 0;

    return {
      content,
      citations,
      searchCount,
      tokenCount,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      throw new PerplexityError(
        "Research query timed out after 5 minutes",
        undefined,
        true
      );
    }

    if (error instanceof PerplexityError) {
      throw error;
    }

    throw new PerplexityError(
      `Failed to perform research: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Formats research content and citations for inclusion in lesson generation prompt
 */
export function formatResearchForPrompt(
  content: string,
  citations: Citation[],
  maxLength: number = 8000
): string {
  let researchSection = content;

  // Truncate if too long
  if (researchSection.length > maxLength) {
    researchSection = researchSection.slice(0, maxLength) + "\n\n[Research content truncated...]";
  }

  // Format citations
  const citationSection = citations
    .map((c) => `[${c.index}] ${c.title} (${c.domain})\n    ${c.snippet}`)
    .join("\n\n");

  return `## RESEARCH CONTEXT
${researchSection}

## AVAILABLE CITATIONS
${citationSection || "No citations available."}`;
}
