/**
 * AI Provider Factory + Selection with Retry/Fallback
 *
 * Orchestrates AI bullet selection with:
 * - Provider factory
 * - Retry logic (3 attempts, includes error context)
 * - Provider fallback (only on provider DOWN)
 */

import type {
  AIProvider,
  AIProviderInterface,
  SelectionRequest,
  SelectionResult,
  SelectionOptions,
} from './types'
import { FALLBACK_ORDER, getNextFallback, DEFAULT_SELECTION_OPTIONS } from './types'
import { AnthropicProvider } from './anthropic'
import { CerebrasProvider } from './cerebras'
import { AISelectionError, formatRustStyleError, type ParseError } from '../errors'

/**
 * Create provider instance by name
 */
export function getProvider(name: AIProvider): AIProviderInterface {
  switch (name) {
    case 'claude-sonnet':
      return new AnthropicProvider('claude-sonnet')
    case 'claude-haiku':
      return new AnthropicProvider('claude-haiku')
    case 'cerebras-gpt':
      return new CerebrasProvider('cerebras-gpt')
    case 'cerebras-llama':
      return new CerebrasProvider('cerebras-llama')
    default:
      throw new Error(`Unknown provider: ${name}`)
  }
}

/**
 * Check if any provider is available
 */
export function getFirstAvailableProvider(): AIProvider | null {
  for (const provider of FALLBACK_ORDER) {
    if (getProvider(provider).isAvailable()) {
      return provider
    }
  }
  return null
}

/**
 * Get all available providers
 */
export function getAvailableProviders(): AIProvider[] {
  return FALLBACK_ORDER.filter((p) => getProvider(p).isAvailable())
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
  options: SelectionOptions = {}
): Promise<SelectionResult> {
  const { maxRetries, enableFallback } = {
    ...DEFAULT_SELECTION_OPTIONS,
    ...options,
  }

  let currentProvider = providerName
  const allErrors: ParseError[] = []
  let totalRetries = 0

  // Outer loop: provider fallback
  while (currentProvider) {
    const provider = getProvider(currentProvider)

    if (!provider.isAvailable()) {
      console.warn(`[AI] Provider ${currentProvider} not available, trying fallback`)
      if (enableFallback) {
        currentProvider = getNextFallback(currentProvider)!
        continue
      }
      break
    }

    // Inner loop: retry same provider
    let retryRequest = { ...request }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      totalRetries++
      console.log(`[AI] Attempt ${attempt}/${maxRetries} with ${currentProvider}`)

      try {
        const result = await provider.select(retryRequest)
        console.log(`[AI] Success with ${currentProvider} after ${attempt} attempt(s)`)
        return result
      } catch (error) {
        if (!(error instanceof AISelectionError)) {
          // Unknown error - wrap and track
          const parseError: ParseError = {
            code: 'E000_PROVIDER_ERROR',
            message: error instanceof Error ? error.message : String(error),
            help: 'Unexpected error',
          }
          allErrors.push(parseError)
          console.error(`[AI] Unexpected error:`, error)

          // Check if this is the last retry - if so, try fallback or throw
          if (attempt === maxRetries) {
            console.error(`[AI] All ${maxRetries} retries exhausted for ${currentProvider}`)
            if (enableFallback) {
              const nextProvider = getNextFallback(currentProvider)
              if (nextProvider) {
                console.log(`[AI] Trying fallback provider: ${nextProvider}`)
                currentProvider = nextProvider
                break // Break inner loop to try next provider
              }
            }
            // No more fallbacks - throw aggregated error
            throw new AISelectionError(
              `Failed after ${maxRetries} attempts with ${currentProvider}`,
              allErrors,
              currentProvider,
              totalRetries
            )
          }
          continue // Try again with same provider
        }

        allErrors.push(...error.errors)

        // Provider DOWN → fallback immediately
        if (error.isProviderDown()) {
          console.warn(`[AI] Provider ${currentProvider} is DOWN, trying fallback`)
          if (enableFallback) {
            currentProvider = getNextFallback(currentProvider)!
            break // Break inner loop, continue outer
          }
          // No fallback enabled - throw
          throw new AISelectionError(
            `Provider ${currentProvider} unavailable`,
            allErrors,
            currentProvider,
            totalRetries
          )
        }

        // Output format error → retry with error context
        if (error.isOutputFormatError() && attempt < maxRetries) {
          const errorContext = formatRustStyleError(error.errors[0])
          console.log(`[AI] Output format error, retrying with context`)
          retryRequest = {
            ...request,
            retryContext: errorContext,
          }
          continue
        }

        // Last retry exhausted
        if (attempt === maxRetries) {
          console.error(`[AI] All ${maxRetries} retries exhausted for ${currentProvider}`)

          // Try fallback if enabled
          if (enableFallback) {
            const nextProvider = getNextFallback(currentProvider)
            if (nextProvider) {
              console.log(`[AI] Trying fallback provider: ${nextProvider}`)
              currentProvider = nextProvider
              break // Break inner loop, continue outer
            }
          }

          // No more fallbacks
          throw new AISelectionError(
            `Failed after ${maxRetries} attempts with ${currentProvider}`,
            allErrors,
            currentProvider,
            totalRetries
          )
        }
      }
    }
  }

  // No providers available
  throw new AISelectionError(
    'No AI providers available',
    allErrors.length > 0
      ? allErrors
      : [
          {
            code: 'E011_PROVIDER_DOWN',
            message: 'All providers unavailable',
            help: 'Check API keys in environment variables',
          },
        ],
    providerName,
    totalRetries
  )
}

// Re-export types and utilities
export * from './types'
export { AnthropicProvider, createAnthropicProvider } from './anthropic'
export { CerebrasProvider, createCerebrasProvider } from './cerebras'
