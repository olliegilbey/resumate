/**
 * AI Provider Types and Configuration
 *
 * Defines the provider interface and model configurations for
 * Claude (Anthropic) and Cerebras (GPT-OSS, Llama) models.
 */

import type { ResumeData } from "@/lib/types/generated-resume";

/**
 * Model identifier used by routes and UI to pick a provider.
 * Mirrors the keys of `AI_MODELS`.
 */
export type AIProvider = "cerebras-gpt" | "cerebras-llama" | "claude-sonnet" | "claude-haiku";

/**
 * Backend vendor that serves the model. `AIProvider` values map onto one of these.
 */
export type ProviderBackend = "anthropic" | "cerebras";

// Model configuration
export interface ModelConfig {
  provider: ProviderBackend;
  model: string;
  label: string;
  cost: "free" | "paid";
  contextWindow: number;
  maxOutputTokens: number;
}

// Model availability status returned by /api/models
export interface ModelAvailability {
  id: AIProvider;
  label: string;
  cost: "free" | "paid";
  available: boolean;
  reason?: string;
}

/**
 * AI Model configurations
 *
 * cerebras-gpt is the DEFAULT - fast, quality, free
 */
export const AI_MODELS: Record<AIProvider, ModelConfig> = {
  "cerebras-gpt": {
    provider: "cerebras",
    model: "qwen-3-235b-a22b-instruct-2507", // Cerebras free-tier replacement for gpt-oss-120b
    label: "Qwen 3 235B (Fast)",
    cost: "free",
    contextWindow: 128000,
    maxOutputTokens: 4096,
  },
  "cerebras-llama": {
    provider: "cerebras",
    model: "llama3.1-8b",
    label: "Llama 3.1 8B",
    cost: "free",
    contextWindow: 128000,
    maxOutputTokens: 4096,
  },
  "claude-sonnet": {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514", // Claude Sonnet 4
    label: "Claude Sonnet 4",
    cost: "paid",
    contextWindow: 200000,
    maxOutputTokens: 8192,
  },
  "claude-haiku": {
    provider: "anthropic",
    model: "claude-3-5-haiku-20241022", // Claude Haiku 3.5
    label: "Claude Haiku 3.5",
    cost: "paid",
    contextWindow: 200000,
    maxOutputTokens: 8192,
  },
} as const;

/**
 * Provider fallback order
 *
 * Used when a provider is DOWN (not for output format errors).
 * Prioritizes free providers, then paid.
 */
export const FALLBACK_ORDER: AIProvider[] = [
  "cerebras-gpt", // Default - fast & free
  "claude-haiku", // Budget paid option
  "cerebras-llama", // Alternative free
  "claude-sonnet", // Premium paid (last resort)
];

// Salary information extracted from job description
export interface SalaryInfo {
  min?: number;
  max?: number;
  currency: string;
  period: "annual" | "monthly" | "hourly" | "daily" | "weekly";
}

/**
 * Inputs to `AIProviderInterface.select` — the job description, the compendium
 * of bullets to score against, count targets, and optional retry feedback
 * appended to the user prompt on subsequent attempts.
 */
export interface SelectionRequest {
  jobDescription: string;
  compendium: ResumeData;
  maxBullets: number;
  minBullets?: number; // Minimum AI must return (default: 30, for tests can be lower)
  maxPerCompany?: number;
  maxPerPosition?: number;
  retryContext?: string; // Error feedback from previous attempt
}

/**
 * A single AI-scored bullet: the compendium bullet `id` plus its assigned
 * relevance `score` in 0.0–1.0 (higher is more relevant).
 */
export interface ScoredBulletSelection {
  id: string;
  score: number; // 0.0-1.0, higher = more relevant
}

/**
 * Full response from `AIProviderInterface.select`: scored bullets plus parsed
 * metadata (reasoning, job title, salary) and bookkeeping (provider used,
 * prompt text, tokens, retry count) for analytics.
 */
export interface SelectionResult {
  bullets: ScoredBulletSelection[];
  reasoning: string;
  jobTitle: string | null;
  salary: SalaryInfo | null;
  tokensUsed?: number;
  provider: AIProvider;
  promptUsed: string; // User prompt sent to AI (for analytics)
  attemptCount: number; // 1 = success first try, >1 = needed retries
}

/**
 * Contract implemented by every AI provider (`CerebrasProvider`, `AnthropicProvider`).
 *
 * Providers scoring bullets against a job description, returning a validated
 * `SelectionResult`. `isAvailable()` gates the provider based on API key presence
 * without requiring a network call.
 */
export interface AIProviderInterface {
  readonly name: AIProvider;
  readonly config: ModelConfig;

  /**
   * Select bullets from compendium based on job description
   */
  select(request: SelectionRequest): Promise<SelectionResult>;

  /**
   * Check if provider is available (API key set, etc.)
   */
  isAvailable(): boolean;
}

/**
 * Runtime knobs for the provider orchestrator in `lib/ai/providers/index.ts`:
 * how many retries before failing over, and the per-call timeout ceiling.
 */
export interface SelectionOptions {
  maxRetries?: number;
  timeoutMs?: number;
}

// Note: DEFAULT_SELECTION_CONFIG is in lib/selection.ts (source of truth)
// Do not add a duplicate here - it was removed to prevent divergence

/**
 * Defaults applied when `selectBulletsWithAI` is called without overrides:
 * 3 retries max, 30-second timeout per provider attempt.
 */
export const DEFAULT_SELECTION_OPTIONS: Required<SelectionOptions> = {
  maxRetries: 3,
  timeoutMs: 30000,
};
