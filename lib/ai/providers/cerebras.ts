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
} from './types'
import { AI_MODELS } from './types'
import { buildUserPrompt, loadSystemPrompt } from '../prompts/user-template'
import {
  parseAIOutput,
  buildBulletHierarchy,
  extractAllBulletIds,
} from '../output-parser'
import { AISelectionError, type ParseError } from '../errors'

const CEREBRAS_API_URL = 'https://api.cerebras.ai/v1/chat/completions'

type CerebrasProviderKey = 'cerebras-gpt' | 'cerebras-llama'

interface CerebrasResponse {
  choices: Array<{
    message: {
      content: string
      role: string
    }
    finish_reason: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

interface CerebrasErrorResponse {
  error?: {
    message: string
    type: string
    code?: string
  }
}

export class CerebrasProvider implements AIProviderInterface {
  readonly name: AIProvider
  readonly config: ModelConfig

  constructor(modelKey: CerebrasProviderKey = 'cerebras-gpt') {
    this.name = modelKey
    this.config = AI_MODELS[modelKey]
  }

  /**
   * Check if provider is available (API key configured)
   */
  isAvailable(): boolean {
    return !!process.env.CEREBRAS_API_KEY
  }

  /**
   * Select bullets from compendium based on job description
   */
  async select(request: SelectionRequest): Promise<SelectionResult> {
    const apiKey = process.env.CEREBRAS_API_KEY
    if (!apiKey) {
      throw new AISelectionError(
        'Cerebras API key not configured',
        [
          {
            code: 'E010_PROVIDER_DOWN',
            message: 'CEREBRAS_API_KEY environment variable not set',
            help: 'Set CEREBRAS_API_KEY in .env.local',
          },
        ],
        this.name,
        0
      )
    }

    const systemPrompt = await loadSystemPrompt()
    const userPrompt = buildUserPrompt(request.jobDescription, request.compendium, {
      maxBullets: request.maxBullets,
      maxPerCompany: request.maxPerCompany,
      maxPerPosition: request.maxPerPosition,
      retryContext: request.retryContext,
    })

    try {
      const response = await fetch(CEREBRAS_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: this.config.maxOutputTokens,
          temperature: 0.3,
        }),
      })

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as CerebrasErrorResponse
        const errorMessage = errorBody.error?.message ?? `HTTP ${response.status}`

        const parseError: ParseError = {
          code: this.isProviderDownStatus(response.status)
            ? 'E010_PROVIDER_DOWN'
            : 'E000_PROVIDER_ERROR',
          message: errorMessage,
          help: `Status: ${response.status}, Type: ${errorBody.error?.type ?? 'unknown'}`,
        }

        throw new AISelectionError(errorMessage, [parseError], this.name, 0)
      }

      const data = (await response.json()) as CerebrasResponse

      if (!data.choices?.[0]?.message?.content) {
        throw new AISelectionError(
          'No content in response',
          [
            {
              code: 'E001_NO_JSON_FOUND',
              message: 'Cerebras response contained no content',
              help: `Response: ${JSON.stringify(data).slice(0, 200)}`,
            },
          ],
          this.name,
          0
        )
      }

      const rawText = data.choices[0].message.content

      // Parse and validate response
      const validIds = extractAllBulletIds(request.compendium.experience)
      const hierarchy = buildBulletHierarchy(request.compendium.experience)

      const parseResult = parseAIOutput(rawText, validIds, hierarchy, {
        maxBullets: request.maxBullets,
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

      return {
        bulletIds: parseResult.data!.bulletIds,
        reasoning: parseResult.data!.reasoning,
        jobTitle: parseResult.data!.jobTitle,
        salary: parseResult.data!.salary,
        tokensUsed: data.usage?.total_tokens,
        provider: this.name,
      }
    } catch (error) {
      // Re-throw AISelectionError as-is
      if (error instanceof AISelectionError) {
        throw error
      }

      // Network or other fetch errors
      throw new AISelectionError(
        `Cerebras request failed: ${error instanceof Error ? error.message : String(error)}`,
        [
          {
            code: 'E010_PROVIDER_DOWN',
            message: String(error),
            help: 'Network error or Cerebras API unavailable',
          },
        ],
        this.name,
        0
      )
    }
  }

  /**
   * Check if HTTP status indicates provider is down
   */
  private isProviderDownStatus(status: number): boolean {
    // 5xx = server issues, 429 = rate limited, 401/403 = auth issues
    const downStatuses = [401, 403, 429, 500, 502, 503, 504]
    return downStatuses.includes(status)
  }
}

/**
 * Create Cerebras provider for specific model
 * Defaults to gpt-oss-120b (fast + free)
 */
export function createCerebrasProvider(
  model: 'cerebras-gpt' | 'cerebras-llama' = 'cerebras-gpt'
): CerebrasProvider {
  return new CerebrasProvider(model)
}
