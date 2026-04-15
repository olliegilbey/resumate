/**
 * Heuristic bullet scoring for `/api/resume/select`.
 *
 * Scores bullets against a {@link RoleProfile} using tag relevance, priority,
 * and hierarchical (company/position) multipliers. Extracted from
 * `route.ts` so the handler stays focused on HTTP concerns.
 *
 * @module app/api/resume/select/scoring
 */

import type { Bullet, Company, Position, ResumeData, RoleProfile } from "@/types/resume";
import { type ScoredBullet, type SelectionConfig } from "@/lib/selection";
import { applyDiversityConstraints } from "@/lib/selection-diversity";

/**
 * Load resume data from the build cache.
 *
 * @returns Resume data from `data/resume-data.json`, or `null` on error.
 */
export async function loadResumeData(): Promise<ResumeData | null> {
  try {
    const data = await import("@/data/resume-data.json");
    return (data.default || data) as unknown as ResumeData;
  } catch (error) {
    console.error("Failed to load resume data:", error);
    return null;
  }
}

/**
 * TypeScript implementation of the heuristic bullet selection algorithm.
 * Scores every bullet (plus position descriptions) against the role profile,
 * sorts by score, then applies diversity constraints.
 *
 * @param resumeData - Full resume compendium.
 * @param roleProfile - Profile containing tag weights and scoring weights.
 * @param config - Diversity constraints (max total / per-company / per-position).
 * @returns Bullets selected after constraints, sorted by score descending.
 */
export function selectBullets(
  resumeData: ResumeData,
  roleProfile: RoleProfile,
  config: SelectionConfig,
): ScoredBullet[] {
  const allBullets: ScoredBullet[] = [];

  // Collect all bullets with scores
  for (const company of resumeData.experience) {
    for (const position of company.children) {
      // Score position description as bullet (if it exists)
      if (position.description) {
        const descBullet = {
          id: `${position.id}-description`,
          description: position.description,
          tags: position.tags || [],
          priority: position.priority || 5,
        };

        const descScore = scoreBullet(descBullet, position, company, roleProfile);

        allBullets.push({
          bullet: descBullet,
          score: descScore,
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

      // Score regular bullets
      for (const bullet of position.children) {
        const score = scoreBullet(bullet, position, company, roleProfile);

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

  // Sort by score descending
  allBullets.sort((a, b) => b.score - a.score);

  // Apply diversity constraints
  return applyDiversityConstraints(allBullets, config);
}

/**
 * Score a single bullet against a role profile.
 *
 * Base score = tag relevance × weight + priority × weight.
 * Multiplied by company and position multipliers.
 */
function scoreBullet(
  bullet: Bullet | { id: string; description: string; tags: string[]; priority: number },
  position: Position,
  company: Company,
  roleProfile: RoleProfile,
): number {
  const weights = roleProfile.scoringWeights;

  // Tag relevance score
  const tagScore = calculateTagRelevance(bullet.tags, roleProfile.tagWeights);

  // Priority score (normalized 0-1)
  const priorityScore = bullet.priority / 10.0;

  // Base score
  const baseScore = tagScore * weights.tagRelevance + priorityScore * weights.priority;

  // Hierarchical multipliers
  const companyMultiplier = calculateCompanyMultiplier(company);
  const positionMultiplier = calculatePositionMultiplier(position, roleProfile.tagWeights);

  return baseScore * companyMultiplier * positionMultiplier;
}

/**
 * Average tag weight for tags that appear in the role profile's weight map.
 * Returns 0 when no tags match (or bullet is untagged).
 */
function calculateTagRelevance(bulletTags: string[], tagWeights: Record<string, number>): number {
  if (!bulletTags || bulletTags.length === 0 || !tagWeights) {
    return 0.0;
  }

  let totalWeight = 0.0;
  let matchedTags = 0;

  for (const tag of bulletTags) {
    const weight = tagWeights[tag];
    if (weight !== undefined) {
      totalWeight += weight;
      matchedTags++;
    }
  }

  if (matchedTags === 0) {
    return 0.0;
  }

  return totalWeight / matchedTags;
}

/**
 * Map company priority (1-10) to a 0.8-1.2 multiplier.
 */
function calculateCompanyMultiplier(company: Company): number {
  if (company.priority) {
    return 0.8 + (company.priority / 10.0) * 0.4;
  }
  return 1.0;
}

/**
 * Position multiplier = priority multiplier × tag multiplier.
 * Priority → 0.8-1.2, tag relevance → 0.9-1.1.
 */
function calculatePositionMultiplier(
  position: Position,
  tagWeights: Record<string, number>,
): number {
  const priorityMultiplier = 0.8 + (position.priority / 10.0) * 0.4;

  let tagMultiplier = 1.0;
  if (position.tags && position.tags.length > 0) {
    const tagScore = calculateTagRelevance(position.tags, tagWeights);
    tagMultiplier = 0.9 + tagScore * 0.2;
  }

  return priorityMultiplier * tagMultiplier;
}
