/**
 * AI Provider Types and Configuration
 *
 * Defines the provider interface and model configurations for
 * Claude (Anthropic) and Cerebras (GPT-OSS, Llama) models.
 */

import type { ResumeData } from '@/lib/types/generated-resume'

// Provider identifiers
export type AIProvider =
  | 'cerebras-gpt'
  | 'cerebras-llama'
  | 'claude-sonnet'
  | 'claude-haiku'

// Provider backend type
export type ProviderBackend = 'anthropic' | 'cerebras'

// Model configuration
export interface ModelConfig {
  provider: ProviderBackend
  model: string
  label: string
  cost: 'free' | 'paid'
  contextWindow: number
  maxOutputTokens: number
}

/**
 * AI Model configurations
 *
 * cerebras-gpt is the DEFAULT - fast, quality, free
 */
export const AI_MODELS: Record<AIProvider, ModelConfig> = {
  'cerebras-gpt': {
    provider: 'cerebras',
    model: 'gpt-oss-120b', // Cerebras reasoning model
    label: 'GPT OSS 120B (Fast)',
    cost: 'free',
    contextWindow: 128000,
    maxOutputTokens: 4096,
  },
  'cerebras-llama': {
    provider: 'cerebras',
    model: 'llama-3.3-70b',
    label: 'Llama 3.3 70B',
    cost: 'free',
    contextWindow: 128000,
    maxOutputTokens: 4096,
  },
  'claude-sonnet': {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514', // Claude Sonnet 4
    label: 'Claude Sonnet 4',
    cost: 'paid',
    contextWindow: 200000,
    maxOutputTokens: 8192,
  },
  'claude-haiku': {
    provider: 'anthropic',
    model: 'claude-3-5-haiku-20241022', // Claude Haiku 3.5
    label: 'Claude Haiku 3.5',
    cost: 'paid',
    contextWindow: 200000,
    maxOutputTokens: 8192,
  },
} as const

/**
 * Provider fallback order
 *
 * Used when a provider is DOWN (not for output format errors).
 * Prioritizes free providers, then paid.
 */
export const FALLBACK_ORDER: AIProvider[] = [
  'cerebras-gpt', // Default - fast & free
  'claude-haiku', // Budget paid option
  'cerebras-llama', // Alternative free
  'claude-sonnet', // Premium paid (last resort)
]

/**
 * Get the next fallback provider after the current one
 */
export function getNextFallback(current: AIProvider): AIProvider | null {
  const currentIndex = FALLBACK_ORDER.indexOf(current)
  if (currentIndex === -1 || currentIndex === FALLBACK_ORDER.length - 1) {
    return null
  }
  return FALLBACK_ORDER[currentIndex + 1]
}

// Salary information extracted from job description
export interface SalaryInfo {
  min?: number
  max?: number
  currency: string
  period: 'annual' | 'monthly' | 'hourly' | 'daily' | 'weekly'
}

// Selection request sent to AI provider
export interface SelectionRequest {
  jobDescription: string
  compendium: ResumeData
  maxBullets: number
  minBullets?: number // Minimum AI must return (default: 30, for tests can be lower)
  maxPerCompany?: number
  maxPerPosition?: number
  retryContext?: string // Error feedback from previous attempt
}

// Bullet with AI-assigned score
export interface ScoredBulletSelection {
  id: string
  score: number // 0.0-1.0, higher = more relevant
}

// Selection result from AI provider
export interface SelectionResult {
  bullets: ScoredBulletSelection[]
  reasoning: string
  jobTitle: string | null
  salary: SalaryInfo | null
  tokensUsed?: number
  provider: AIProvider
}

// AI Provider interface
export interface AIProviderInterface {
  readonly name: AIProvider
  readonly config: ModelConfig

  /**
   * Select bullets from compendium based on job description
   */
  select(request: SelectionRequest): Promise<SelectionResult>

  /**
   * Check if provider is available (API key set, etc.)
   */
  isAvailable(): boolean
}

// Selection options
export interface SelectionOptions {
  maxRetries?: number
  timeoutMs?: number
  enableFallback?: boolean
}

// Note: DEFAULT_SELECTION_CONFIG is in lib/ai/selection.ts (source of truth)
// Do not add a duplicate here - it was removed to prevent divergence

// Default selection options
export const DEFAULT_SELECTION_OPTIONS: Required<SelectionOptions> = {
  maxRetries: 3,
  timeoutMs: 30000,
  enableFallback: true,
}
