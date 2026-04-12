/**
 * AI Provider Factory + Selection with Retry
 *
 * Orchestrates AI bullet selection with:
 * - Provider factory
 * - Retry logic (3 attempts, includes error context)
 * - Fail-fast on provider down (user picks a different model)
 */

import type {
  AIProvider,
  AIProviderInterface,
  SelectionRequest,
  SelectionResult,
  SelectionOptions,
} from "./types";
import { FALLBACK_ORDER, DEFAULT_SELECTION_OPTIONS } from "./types";
import { AnthropicProvider } from "./anthropic";
import { CerebrasProvider } from "./cerebras";
import { AISelectionError, formatRustStyleError, type ParseError } from "../errors";

/**
 * Create provider instance by name
 */
export function getProvider(name: AIProvider): AIProviderInterface {
  switch (name) {
    case "claude-sonnet":
      return new AnthropicProvider("claude-sonnet");
    case "claude-haiku":
      return new AnthropicProvider("claude-haiku");
    case "cerebras-gpt":
      return new CerebrasProvider("cerebras-gpt");
    case "cerebras-llama":
      return new CerebrasProvider("cerebras-llama");
    default:
      throw new Error(`Unknown provider: ${name}`);
  }
}

/**
 * Check if any provider is available
 */
export function getFirstAvailableProvider(): AIProvider | null {
  for (const provider of FALLBACK_ORDER) {
    if (getProvider(provider).isAvailable()) {
      return provider;
    }
  }
  return null;
}

/**
 * Get all available providers
 */
export function getAvailableProviders(): AIProvider[] {
  return FALLBACK_ORDER.filter((p) => getProvider(p).isAvailable());
}

/**
 * Select bullets using AI with retry and fallback
 *
 * Retry strategy:
 * - On output format errors → retry same provider with error context
 * - On provider DOWN → fallback to next provider
 *
 * @param request Selection parameters
 * @param providerName Initial provider (defaults to first in fallback order)
 * @param options Retry and timeout configuration
 */
export async function selectBulletsWithAI(
  request: SelectionRequest,
  providerName: AIProvider = FALLBACK_ORDER[0],
  options: SelectionOptions = {},
): Promise<SelectionResult> {
  const { maxRetries } = {
    ...DEFAULT_SELECTION_OPTIONS,
    ...options,
  };

  const provider = getProvider(providerName);

  if (!provider.isAvailable()) {
    throw new AISelectionError(
      `Provider ${providerName} is not configured`,
      [
        {
          code: "E011_PROVIDER_DOWN",
          message: `${providerName} API key not set`,
          help: "Please select a different AI model.",
        },
      ],
      providerName,
      0,
    );
  }

  const allErrors: ParseError[] = [];
  let retryRequest = { ...request };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.warn(`[AI] Attempt ${attempt}/${maxRetries} with ${providerName}`);

    try {
      const result = await provider.select(retryRequest);
      console.warn(`[AI] Success with ${providerName} after ${attempt} attempt(s)`);
      return {
        ...result,
        attemptCount: attempt,
      };
    } catch (error) {
      if (!(error instanceof AISelectionError)) {
        const parseError: ParseError = {
          code: "E000_PROVIDER_ERROR",
          message: error instanceof Error ? error.message : String(error),
          help: "Unexpected error",
        };
        allErrors.push(parseError);
        console.error(`[AI] Unexpected error:`, error);

        if (attempt === maxRetries) {
          throw new AISelectionError(
            `Failed after ${maxRetries} attempts with ${providerName}`,
            allErrors,
            providerName,
            attempt,
          );
        }
        continue;
      }

      allErrors.push(...error.errors);

      // Provider DOWN → fail fast, let user pick a different model
      if (error.isProviderDown()) {
        console.warn(`[AI] Provider ${providerName} is DOWN`);
        throw new AISelectionError(
          `${providerName} is unavailable. Please select a different model.`,
          allErrors,
          providerName,
          attempt,
        );
      }

      const isFormatError = error.isOutputFormatError();

      // Output format error → retry with error context
      if (isFormatError && attempt < maxRetries) {
        const errorContext = formatRustStyleError(error.errors[0]);
        console.warn(`[AI] Output format error, retrying with context`);
        retryRequest = {
          ...request,
          retryContext: errorContext,
        };
        continue;
      }

      // Non-format provider errors should fail immediately
      if (attempt === maxRetries || !isFormatError) {
        console.error(
          isFormatError
            ? `[AI] All ${maxRetries} retries exhausted for ${providerName}`
            : `[AI] Non-retryable error from ${providerName}`,
        );
        throw new AISelectionError(
          isFormatError
            ? `Failed after ${maxRetries} attempts with ${providerName}`
            : `Selection failed with ${providerName}`,
          allErrors,
          providerName,
          attempt,
        );
      }
    }
  }

  // Unreachable — the for-loop always throws on maxRetries
  throw new AISelectionError(`Selection failed with ${providerName}`, allErrors, providerName, 0);
}

// Re-export types and utilities
export * from "./types";
export { AnthropicProvider, createAnthropicProvider } from "./anthropic";
export { CerebrasProvider, createCerebrasProvider } from "./cerebras";
