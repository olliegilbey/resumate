/**
 * Bullet Selection Algorithm
 *
 * Single source of truth for applying diversity constraints to scored bullets.
 * Used by both heuristic (`/api/resume/select`) and AI (`/api/resume/ai-select`) scoring paths.
 *
 * Flow: Scoring (server) → Selection (this module) → Compilation (WASM)
 *
 * @module lib/selection
 */

import type { Bullet, ResumeData } from "@/types/resume";

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
 * Select top bullets applying diversity constraints.
 *
 * Algorithm:
 * 1. Build full bullet objects from resume data + scores
 * 2. Sort by score descending
 * 3. Select bullets while respecting per-company and per-position limits
 * 4. Remove companies with fewer than minPerCompany bullets
 *
 * @param resumeData - Full resume data (compendium)
 * @param scores - Map of bullet ID → score (0-1). Bullets missing from the map are skipped.
 * @param config - Selection configuration (defaults to `DEFAULT_SELECTION_CONFIG`)
 * @returns Selected bullets ordered by score (descending) with diversity constraints applied
 *
 * @example
 * ```ts
 * const scores = new Map([["b-1", 0.95], ["b-2", 0.70]])
 * const selected = selectBulletsWithConstraints(resumeData, scores, {
 *   maxBullets: 24,
 *   maxPerCompany: 6,
 *   maxPerPosition: 4,
 *   minPerCompany: 2,
 * })
 * ```
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

/**
 * Applies diversity constraints to a pre-sorted list of scored bullets.
 *
 * Ensures balanced representation across companies and positions by enforcing:
 * - Maximum total bullets (hard ceiling)
 * - Maximum bullets per company (prevents one employer dominating)
 * - Maximum bullets per position (prevents one role dominating)
 * - Minimum bullets per company (removes sparse single-bullet companies)
 *
 * @param sortedBullets - Pre-scored bullets, must be sorted by score descending
 * @param config - Diversity constraint configuration
 * @returns Filtered bullets respecting all constraints, maintaining score order
 *
 * @example
 * ```ts
 * const scored = scoreBullets(resumeData, roleProfile)
 * scored.sort((a, b) => b.score - a.score)
 * const selected = applyDiversityConstraints(scored, { maxBullets: 24, maxPerCompany: 6 })
 * ```
 */
export function applyDiversityConstraints<T extends ScoredBullet>(
  sortedBullets: T[],
  config: SelectionConfig,
): T[] {
  const { maxBullets, maxPerCompany, maxPerPosition, minPerCompany } = config;

  const selected: T[] = [];
  const companyCount: Record<string, number> = {};
  const positionCount: Record<string, number> = {};

  for (const bullet of sortedBullets) {
    // Check maxBullets limit (ceiling)
    if (selected.length >= maxBullets) {
      break;
    }

    // Check per-company limit (0 or undefined = no limit)
    if (maxPerCompany && maxPerCompany > 0) {
      const count = companyCount[bullet.companyId] || 0;
      if (count >= maxPerCompany) {
        continue;
      }
    }

    // Check per-position limit (0 or undefined = no limit)
    if (maxPerPosition && maxPerPosition > 0) {
      const count = positionCount[bullet.positionId] || 0;
      if (count >= maxPerPosition) {
        continue;
      }
    }

    // Add bullet and increment counters
    companyCount[bullet.companyId] = (companyCount[bullet.companyId] || 0) + 1;
    positionCount[bullet.positionId] = (positionCount[bullet.positionId] || 0) + 1;
    selected.push(bullet);
  }

  // Enforce minimum bullets per company (avoid single-bullet companies)
  if (minPerCompany && minPerCompany > 1) {
    // Count bullets per company in selected set
    const finalCompanyCount: Record<string, number> = {};
    for (const bullet of selected) {
      finalCompanyCount[bullet.companyId] = (finalCompanyCount[bullet.companyId] || 0) + 1;
    }

    // Filter out companies with fewer than minimum bullets
    const filtered = selected.filter((bullet) => {
      const count = finalCompanyCount[bullet.companyId] || 0;
      return count >= minPerCompany;
    });

    return filtered;
  }

  return selected;
}

/**
 * Reorder selected bullets to match the company order defined in `resumeData.experience`
 * (most-recent first by convention), while keeping bullets within each company sorted by
 * score descending.
 *
 * Companies not present in `resumeData.experience` are placed last. Within a company,
 * bullet order is preserved by score (the function re-sorts defensively even if the input
 * is already score-ordered).
 *
 * @param selected - Bullets chosen by `applyDiversityConstraints` or
 *   `selectBulletsWithConstraints`, score-ordered
 * @param resumeData - Resume data whose `experience` array defines the canonical company order
 * @returns Same bullets, reordered by company chronology then by score within each company
 *
 * @example
 * ```ts
 * const selected = selectBulletsWithConstraints(resumeData, scoreMap, config)
 * const ordered = reorderByCompanyChronology(selected, resumeData)
 * // → bullets grouped by company in resume-order, each group sorted by score DESC
 * ```
 */
export function reorderByCompanyChronology(
  selected: SelectedBullet[],
  resumeData: ResumeData,
): SelectedBullet[] {
  // Build company order map from resume data
  const companyOrder = new Map<string, number>();
  resumeData.experience.forEach((company, index) => {
    companyOrder.set(company.id, index);
  });

  // Group selected bullets by company
  const byCompany = new Map<string, SelectedBullet[]>();
  for (const bullet of selected) {
    const existing = byCompany.get(bullet.companyId) || [];
    existing.push(bullet);
    byCompany.set(bullet.companyId, existing);
  }

  // Sort each company's bullets by score (already sorted, but ensure)
  for (const bullets of byCompany.values()) {
    bullets.sort((a, b) => b.score - a.score);
  }

  // Build result in company chronological order
  const result: SelectedBullet[] = [];
  const sortedCompanyIds = Array.from(byCompany.keys()).sort((a, b) => {
    const orderA = companyOrder.get(a) ?? Infinity;
    const orderB = companyOrder.get(b) ?? Infinity;
    return orderA - orderB;
  });

  for (const companyId of sortedCompanyIds) {
    const bullets = byCompany.get(companyId) || [];
    result.push(...bullets);
  }

  return result;
}
