/**
 * Token-count heuristics for keeping prompts within model context windows.
 *
 * Extracted from `prompts/prompt.ts` so each prompt module stays focused and
 * under the `max-lines` guardrail.
 *
 * @module lib/ai/prompts/token-estimation
 */

import type { ResumeData } from "@/lib/types/generated-resume";
import { formatBulletsForPrompt } from "./formatting";

/**
 * Rough token estimate for English text (~4 characters per token).
 *
 * Use as a sanity check before sending large prompts, not for billing.
 *
 * @param text - Input string.
 * @returns Ceiling estimate of token count.
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Check whether the compendium fits within a given model's context window.
 *
 * Reserves 40% of the context for the system prompt + AI response and warns
 * when the compendium alone occupies more than 80% of the usable slice.
 *
 * @param compendium - Full resume data.
 * @param contextLimit - Model context window in tokens (default 128k).
 * @returns Result with `ok` flag and optional warning string.
 */
export function checkCompendiumSize(
  compendium: ResumeData,
  contextLimit: number = 128000,
): { ok: boolean; warning?: string; estimatedTokens: number } {
  const bulletList = formatBulletsForPrompt(compendium);
  const estimatedTokens = estimateTokenCount(bulletList);

  // Use max 60% of context for compendium (leave room for system prompt + response)
  const safeLimit = contextLimit * 0.6;

  if (estimatedTokens > safeLimit) {
    return {
      ok: false,
      warning: `Compendium too large: ~${estimatedTokens} tokens (limit: ${Math.floor(safeLimit)})`,
      estimatedTokens,
    };
  }

  if (estimatedTokens > safeLimit * 0.8) {
    return {
      ok: true,
      warning: `Compendium approaching limit: ~${estimatedTokens} tokens`,
      estimatedTokens,
    };
  }

  return { ok: true, estimatedTokens };
}
