/**
 * Anthropic Provider (Claude Sonnet 4.5 / Haiku 4.5)
 *
 * Uses the official @anthropic-ai/sdk for API calls.
 */

import Anthropic from '@anthropic-ai/sdk'
import type {
  AIProvider,
  AIProviderInterface,
  ModelConfig,
  SelectionRequest,
  SelectionResult,
} from './types'
import { AI_MODELS } from './types'
import { buildUserPrompt, loadSystemPrompt } from '../prompts/user-template'
import { parseAIOutput, buildBulletHierarchy, extractAllBulletIds } from '../output-parser'
import { AISelectionError, type ParseError } from '../errors'

type AnthropicProviderKey = 'claude-sonnet' | 'claude-haiku'

export class AnthropicProvider implements AIProviderInterface {
  readonly name: AIProvider
  readonly config: ModelConfig
  private client: Anthropic | null = null

  constructor(modelKey: AnthropicProviderKey) {
    this.name = modelKey
    this.config = AI_MODELS[modelKey]
  }

  /**
   * Lazy client initialization - only created when needed
   */
  private getClient(): Anthropic {
    if (!this.client) {
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) {
        throw new AISelectionError(
          'Anthropic API key not configured',
          [
            {
              code: 'E011_PROVIDER_DOWN',
              message: 'ANTHROPIC_API_KEY environment variable not set',
              help: 'Set ANTHROPIC_API_KEY in .env.local',
            },
          ],
          this.name,
          0
        )
      }
      this.client = new Anthropic({ apiKey })
    }
    return this.client
  }

  /**
   * Check if provider is available (API key configured)
   */
  isAvailable(): boolean {
    return !!process.env.ANTHROPIC_API_KEY
  }

  /**
   * Select bullets from compendium based on job description
   */
  async select(request: SelectionRequest): Promise<SelectionResult> {
    const client = this.getClient()
    const systemPrompt = await loadSystemPrompt()

    const userPrompt = buildUserPrompt(request.jobDescription, request.compendium, {
      maxBullets: request.maxBullets,
      maxPerCompany: request.maxPerCompany,
      maxPerPosition: request.maxPerPosition,
      retryContext: request.retryContext,
    })

    try {
      const response = await client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxOutputTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      })

      // Extract text content
      const textContent = response.content.find((c) => c.type === 'text')
      if (!textContent || textContent.type !== 'text') {
        throw new AISelectionError(
          'No text content in response',
          [
            {
              code: 'E001_NO_JSON_FOUND',
              message: 'Anthropic response contained no text content',
              help: `Response content types: ${response.content.map((c) => c.type).join(', ')}`,
            },
          ],
          this.name,
          0
        )
      }

      const rawText = textContent.text

      // Parse and validate response
      const validIds = extractAllBulletIds(request.compendium.experience)
      const hierarchy = buildBulletHierarchy(request.compendium.experience)

      const parseResult = parseAIOutput(rawText, validIds, hierarchy, {
        maxBullets: request.maxBullets,
        minBullets: request.minBullets,
        maxPerCompany: request.maxPerCompany,
        maxPerPosition: request.maxPerPosition,
      })

      if (!parseResult.success) {
        throw new AISelectionError(
          parseResult.error!.message,
          [parseResult.error!],
          this.name,
          0
        )
      }

      const tokensUsed =
        (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0)

      return {
        bullets: parseResult.data!.bullets,
        reasoning: parseResult.data!.reasoning,
        jobTitle: parseResult.data!.jobTitle,
        salary: parseResult.data!.salary,
        tokensUsed,
        provider: this.name,
      }
    } catch (error) {
      // Re-throw AISelectionError as-is
      if (error instanceof AISelectionError) {
        throw error
      }

      // Handle Anthropic API errors (duck-type check for testability)
      if (this.isAnthropicAPIError(error)) {
        const parseError: ParseError = {
          code: this.isProviderDownError(error) ? 'E011_PROVIDER_DOWN' : 'E000_PROVIDER_ERROR',
          message: error.message,
          help: `Status: ${error.status}, Type: ${error.name}`,
        }

        throw new AISelectionError(error.message, [parseError], this.name, 0)
      }

      // Unknown error
      throw new AISelectionError(
        `Anthropic request failed: ${error instanceof Error ? error.message : String(error)}`,
        [
          {
            code: 'E000_PROVIDER_ERROR',
            message: String(error),
            help: 'Unexpected error during Anthropic API call',
          },
        ],
        this.name,
        0
      )
    }
  }

  /**
   * Duck-type check for Anthropic API errors (works with mocks)
   */
  private isAnthropicAPIError(error: unknown): error is { status: number; message: string; name: string } {
    return (
      error !== null &&
      typeof error === 'object' &&
      'status' in error &&
      typeof (error as Record<string, unknown>).status === 'number' &&
      'message' in error
    )
  }

  /**
   * Check if error indicates provider is down (should trigger fallback)
   */
  private isProviderDownError(error: { status: number }): boolean {
    // 5xx errors = server issues = provider down
    // 429 = rate limited = provider down (for this request)
    // 401/403 = auth issues = provider down (misconfigured)
    const downStatuses = [401, 403, 429, 500, 502, 503, 504]
    return downStatuses.includes(error.status)
  }
}

/**
 * Create Anthropic provider for specific model
 */
export function createAnthropicProvider(
  model: 'claude-sonnet' | 'claude-haiku' = 'claude-sonnet'
): AnthropicProvider {
  return new AnthropicProvider(model)
}
