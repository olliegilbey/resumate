/**
 * Diversity and ordering helpers for bullet selection.
 *
 * Extracted from `lib/selection.ts` to keep each file under the `max-lines`
 * guardrail. Logic is unchanged.
 *
 * @module lib/selection-diversity
 */

import type { ResumeData } from "@/types/resume";
import type { ScoredBullet, SelectedBullet, SelectionConfig } from "@/lib/selection";

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
 * Reorder selected bullets to maintain chronological company order
 * while keeping bullets within each company sorted by score.
 *
 * @param selected - Bullets selected by {@link applyDiversityConstraints} (score-ordered)
 * @param resumeData - Resume data with company order
 * @returns Bullets grouped by company in resume order, sorted by score within each company
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
