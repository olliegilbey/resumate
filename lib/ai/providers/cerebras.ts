/**
 * Cerebras Provider (GPT-OSS 120B / Llama 3.3 70B)
 *
 * Uses OpenAI-compatible API at api.cerebras.ai
 * Both models are FREE and FAST - default choice.
 */

import type {
  AIProvider,
  AIProviderInterface,
  ModelConfig,
  SelectionRequest,
  SelectionResult,
} from "./types";
import { AI_MODELS } from "./types";
import { buildUserPrompt } from "../prompts/user-prompt";
import { loadSystemPrompt } from "../prompts/system-prompt";
import { parseAIOutput } from "../output-parser";
import { buildBulletHierarchy, extractAllBulletIds } from "../output-parser-hierarchy";
import { AISelectionError, type ParseError } from "../errors";

const CEREBRAS_API_URL = "https://api.cerebras.ai/v1/chat/completions";

type CerebrasProviderKey = "cerebras-gpt" | "cerebras-llama";

interface CerebrasResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface CerebrasErrorResponse {
  error?: {
    message: string;
    type: string;
    code?: string;
  };
}

export class CerebrasProvider implements AIProviderInterface {
  readonly name: AIProvider;
  readonly config: ModelConfig;

  constructor(modelKey: CerebrasProviderKey = "cerebras-gpt") {
    this.name = modelKey;
    this.config = AI_MODELS[modelKey];
  }

  /**
   * Check if provider is available (API key configured)
   */
  isAvailable(): boolean {
    return !!process.env.CEREBRAS_API_KEY;
  }

  /**
   * Select bullets from compendium based on job description
   */
  async select(request: SelectionRequest): Promise<SelectionResult> {
    const apiKey = process.env.CEREBRAS_API_KEY;
    if (!apiKey) {
      throw new AISelectionError(
        "Cerebras API key not configured",
        [
          {
            code: "E011_PROVIDER_DOWN",
            message: "CEREBRAS_API_KEY environment variable not set",
            help: "Set CEREBRAS_API_KEY in .env.local",
          },
        ],
        this.name,
        0,
      );
    }

    const systemPrompt = loadSystemPrompt();
    const userPrompt = buildUserPrompt(request.jobDescription, request.compendium, {
      maxBullets: request.maxBullets,
      maxPerCompany: request.maxPerCompany,
      maxPerPosition: request.maxPerPosition,
      retryContext: request.retryContext,
    });

    try {
      console.warn(`[Cerebras] Calling ${this.config.model}...`);
      const response = await fetch(CEREBRAS_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: this.config.maxOutputTokens,
          temperature: 0.3,
        }),
        // 50s timeout — Cerebras free-tier queue times for popular models
        // (e.g. Qwen 235B) can spike past 30s during heavy traffic. Must
        // stay below the route's `maxDuration` (60s on Hobby) so Vercel
        // doesn't kill the function before the fetch resolves.
        signal: AbortSignal.timeout(50000),
      });

      console.warn(`[Cerebras] Response status: ${response.status}`);

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as CerebrasErrorResponse;
        const errorMessage = errorBody.error?.message ?? `HTTP ${response.status}`;

        const parseError: ParseError = {
          code: this.classifyErrorStatus(response.status),
          message: errorMessage,
          help: `Status: ${response.status}, Type: ${errorBody.error?.type ?? "unknown"}`,
        };

        throw new AISelectionError(errorMessage, [parseError], this.name, 0);
      }

      const data = (await response.json()) as CerebrasResponse;

      if (!data.choices?.[0]?.message?.content) {
        throw new AISelectionError(
          "No content in response",
          [
            {
              code: "E001_NO_JSON_FOUND",
              message: "Cerebras response contained no content",
              help: `Response: ${JSON.stringify(data).slice(0, 200)}`,
            },
          ],
          this.name,
          0,
        );
      }

      const rawText = data.choices[0].message.content;

      // Debug: log raw response
      console.warn("[Cerebras] Raw response (first 500 chars):", rawText.slice(0, 500));

      // Parse and validate response
      const validIds = extractAllBulletIds(request.compendium.experience);
      const hierarchy = buildBulletHierarchy(request.compendium.experience);

      const parseResult = parseAIOutput(rawText, validIds, hierarchy, {
        maxBullets: request.maxBullets,
        minBullets: request.minBullets,
        maxPerCompany: request.maxPerCompany,
        maxPerPosition: request.maxPerPosition,
      });

      if (!parseResult.success) {
        console.warn(
          "[Cerebras] Parse error:",
          parseResult.error!.code,
          "-",
          parseResult.error!.message,
        );
        console.warn("[Cerebras] Help:", parseResult.error!.help?.slice(0, 300));
        throw new AISelectionError(parseResult.error!.message, [parseResult.error!], this.name, 0);
      }

      return {
        bullets: parseResult.data!.bullets,
        reasoning: parseResult.data!.reasoning,
        jobTitle: parseResult.data!.jobTitle,
        salary: parseResult.data!.salary,
        tokensUsed: data.usage?.total_tokens,
        provider: this.name,
        promptUsed: userPrompt,
        attemptCount: 1, // Single provider call, orchestrator tracks total attempts
      };
    } catch (error) {
      // Re-throw AISelectionError as-is
      if (error instanceof AISelectionError) {
        throw error;
      }

      // Distinguish "request took too long" (likely queued behind traffic) from
      // "couldn't reach the provider at all". Both short-circuit the same way
      // in the orchestrator, but the user-facing message differs — a timeout
      // on a known-queueing model should say "busy", not "unavailable".
      const isTimeout =
        error instanceof DOMException
          ? error.name === "TimeoutError" || error.name === "AbortError"
          : false;

      throw new AISelectionError(
        `Cerebras request failed: ${error instanceof Error ? error.message : String(error)}`,
        [
          {
            code: isTimeout ? "E012_PROVIDER_BUSY" : "E011_PROVIDER_DOWN",
            message: String(error),
            help: isTimeout
              ? "Request exceeded provider timeout — Cerebras queue likely backlogged."
              : "Network error or Cerebras API unavailable",
          },
        ],
        this.name,
        0,
      );
    }
  }

  /**
   * Classify an HTTP error status from the Cerebras API.
   *
   * Cerebras free tier returns 429 `queue_exceeded` under transient heavy
   * traffic (e.g. popular models like Qwen 235B). That is *busy*, not *down* —
   * the model is healthy but queueing. Surface it as {@link "E012_PROVIDER_BUSY"}
   * so the user gets a "try a different model or try again shortly" message
   * rather than "currently unavailable".
   *
   * - 401/403/404: auth or model removed → provider down
   * - 500/502/503/504: server issues → provider down
   * - 429: queueing / rate limited → provider busy (separate taxonomy)
   * - anything else: generic provider error (non-retryable format issue)
   */
  private classifyErrorStatus(status: number): ParseError["code"] {
    if (status === 429) return "E012_PROVIDER_BUSY";
    const downStatuses = [401, 403, 404, 500, 502, 503, 504];
    if (downStatuses.includes(status)) return "E011_PROVIDER_DOWN";
    return "E000_PROVIDER_ERROR";
  }
}

/**
 * Create Cerebras provider for specific model
 * Defaults to Qwen 3 235B (fast + free)
 */
export function createCerebrasProvider(
  model: "cerebras-gpt" | "cerebras-llama" = "cerebras-gpt",
): CerebrasProvider {
  return new CerebrasProvider(model);
}
