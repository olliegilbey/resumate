/**
 * AI selection orchestration helpers for `/api/resume/ai-select`.
 *
 * Extracted from `route.ts` so the HTTP handler stays focused on request
 * parsing, rate limiting, and Turnstile verification while this module owns
 * the AI call + diversity constraint + chronology reordering flow.
 *
 * @module app/api/resume/ai-select/flow
 */

import { selectBulletsWithAI } from "@/lib/ai/providers";
import type { AIProvider } from "@/lib/ai/providers/types";
import {
  selectBulletsWithConstraints,
  type SelectedBullet,
  type SelectionConfig,
} from "@/lib/selection";
import { reorderByCompanyChronology } from "@/lib/selection-diversity";
import type { ResumeData } from "@/types/resume";

/**
 * Result of an AI-driven selection pipeline run.
 */
export interface AISelectionPipelineResult {
  /** Bullets chosen after applying diversity constraints and chronology reordering. */
  selected: SelectedBullet[];
  /** Raw AI provider response details (prompt, tokens, reasoning, etc.). */
  aiResult: Awaited<ReturnType<typeof selectBulletsWithAI>>;
  /** Milliseconds spent in the AI provider call. */
  aiDuration: number;
}

/**
 * Call the AI provider, then apply diversity constraints and chronology
 * reordering to the scored bullets.
 *
 * @param params.jobDescription - Raw JD text from the user.
 * @param params.resumeData - Full compendium to score against.
 * @param params.provider - Chosen AI provider identifier.
 * @param params.selectionConfig - Diversity + ceiling constraints.
 */
export async function runAISelectionPipeline(params: {
  jobDescription: string;
  resumeData: ResumeData;
  provider: AIProvider;
  selectionConfig: SelectionConfig;
}): Promise<AISelectionPipelineResult> {
  const { jobDescription, resumeData, provider, selectionConfig } = params;

  const startTime = Date.now();
  const aiResult = await selectBulletsWithAI(
    {
      jobDescription,
      compendium: resumeData,
      maxBullets: selectionConfig.maxBullets, // Passed to AI for context
    },
    provider,
  );
  const aiDuration = Date.now() - startTime;

  // Build score map from AI response
  const scoreMap = new Map<string, number>();
  for (const b of aiResult.bullets) {
    scoreMap.set(b.id, b.score);
  }

  // Apply diversity constraints server-side (ported from Rust)
  const selectedRaw = selectBulletsWithConstraints(resumeData, scoreMap, selectionConfig);

  // Reorder to maintain company chronology (companies in resume order, bullets by score)
  const selected = reorderByCompanyChronology(selectedRaw, resumeData);

  return { selected, aiResult, aiDuration };
}

/**
 * Load resume data from the build cache for AI scoring.
 *
 * @returns Resume data from `data/resume-data.json`, or `null` on error.
 */
export async function loadResumeData(): Promise<ResumeData | null> {
  try {
    const data = await import("@/data/resume-data.json");
    return (data.default || data) as unknown as ResumeData;
  } catch (error) {
    console.error("[AI Select] Failed to load resume data:", error);
    return null;
  }
}
