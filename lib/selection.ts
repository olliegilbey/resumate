/**
 * Bullet Selection Algorithm
 *
 * Single source of truth for applying diversity constraints to scored bullets.
 * Used by both heuristic (`/api/resume/select`) and AI (`/api/resume/ai-select`) scoring paths.
 *
 * Flow: Scoring (server) → Selection (this module) → Compilation (WASM)
 *
 * Diversity/ordering helpers live in `lib/selection-diversity.ts` to keep each
 * file under the `max-lines` guardrail.
 *
 * @module lib/selection
 */

import type { Bullet, ResumeData } from "@/types/resume";
import { applyDiversityConstraints } from "@/lib/selection-diversity";

/**
 * Configuration for bullet selection diversity constraints.
 */
export interface SelectionConfig {
  /** Maximum total bullets to select (ceiling - may select fewer based on constraints) */
  maxBullets: number;
  /** Maximum bullets per company (for diversity across employers) */
  maxPerCompany?: number;
  /** Minimum bullets per company (avoid single-bullet companies that look sparse) */
  minPerCompany?: number;
  /** Maximum bullets per position (prevent one role dominating) */
  maxPerPosition?: number;
}

/**
 * Base interface for scored bullets used in selection.
 * Both heuristic and AI paths produce this shape.
 */
export interface ScoredBullet {
  /** The bullet content (can be a real bullet or synthesized position description) */
  bullet: Bullet | { id: string; description: string; tags: string[]; priority: number };
  /** Computed relevance score (higher = more relevant to role profile) */
  score: number;
  /** Company identifier for diversity constraints */
  companyId: string;
  /** Company display name */
  companyName: string | null | undefined;
  /** Company description/tagline */
  companyDescription: string | null | undefined;
  /** Company website URL */
  companyLink: string | null | undefined;
  /** Company start date (ISO format) */
  companyDateStart: string;
  /** Company end date (ISO format, null if current) */
  companyDateEnd: string | null | undefined;
  /** Company location */
  companyLocation: string | null | undefined;
  /** Position identifier for diversity constraints */
  positionId: string;
  /** Position/role title */
  positionName: string;
  /** Position description */
  positionDescription: string | null | undefined;
  /** Position start date (ISO format) */
  positionDateStart: string;
  /** Position end date (ISO format, null if current) */
  positionDateEnd: string | null | undefined;
}

/**
 * Selected bullet after diversity constraints applied.
 * Alias for ScoredBullet - the shape doesn't change, just the semantics.
 */
export type SelectedBullet = ScoredBullet;

/**
 * Default selection config values
 */
export const DEFAULT_SELECTION_CONFIG: SelectionConfig = {
  maxBullets: 24,
  maxPerCompany: 6,
  minPerCompany: 2, // Avoid standalone single bullets
  maxPerPosition: 4,
};

/**
 * Select top bullets applying diversity constraints
 *
 * Algorithm:
 * 1. Build full bullet objects from resume data + scores
 * 2. Sort by score descending
 * 3. Select bullets while respecting per-company and per-position limits
 * 4. Remove companies with fewer than minPerCompany bullets
 *
 * @param resumeData - Full resume data
 * @param scores - Bullet ID to score map
 * @param config - Selection configuration
 */
export function selectBulletsWithConstraints(
  resumeData: ResumeData,
  scores: Map<string, number>,
  config: SelectionConfig = DEFAULT_SELECTION_CONFIG,
): SelectedBullet[] {
  // Step 1: Build all bullet candidates with scores
  const allBullets: SelectedBullet[] = [];

  for (const company of resumeData.experience) {
    for (const position of company.children) {
      for (const bullet of position.children) {
        const score = scores.get(bullet.id);
        if (score === undefined) continue; // Bullet wasn't scored

        allBullets.push({
          bullet,
          score,
          companyId: company.id,
          companyName: company.name,
          companyDescription: company.description,
          companyLink: company.link,
          companyDateStart: company.dateStart,
          companyDateEnd: company.dateEnd,
          companyLocation: company.location,
          positionId: position.id,
          positionName: position.name,
          positionDescription: position.description,
          positionDateStart: position.dateStart,
          positionDateEnd: position.dateEnd,
        });
      }
    }
  }

  // Step 2: Sort by score descending
  allBullets.sort((a, b) => b.score - a.score);

  // Step 3: Apply diversity constraints
  const selected = applyDiversityConstraints(allBullets, config);

  return selected;
}
