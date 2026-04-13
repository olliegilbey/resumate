/**
 * Hierarchy helpers for AI output parsing.
 *
 * Extracted from `output-parser.ts` so the parser module focuses on JSON
 * extraction + validation while this one handles compendium traversal.
 *
 * @module lib/ai/output-parser-hierarchy
 */

import type { BulletHierarchy } from "./output-parser";

/**
 * Build a `bulletId → { companyId, positionId }` hierarchy map from a compendium
 * subtree. Used by route handlers to attach diversity metadata to scored bullets.
 *
 * @param experience - Resume `experience` array (company → positions → bullets).
 * @returns Flat map keyed by bullet id.
 */
export function buildBulletHierarchy(
  experience: Array<{
    id: string;
    children: Array<{
      id: string;
      children: Array<{ id: string }>;
    }>;
  }>,
): BulletHierarchy {
  const hierarchy: BulletHierarchy = {};

  for (const company of experience) {
    for (const position of company.children) {
      for (const bullet of position.children) {
        hierarchy[bullet.id] = {
          companyId: company.id,
          positionId: position.id,
        };
      }
    }
  }

  return hierarchy;
}

/**
 * Collect every bullet id in a compendium subtree into a `Set` for
 * validation against AI responses.
 *
 * @param experience - Resume `experience` array (company → positions → bullets).
 * @returns Set of bullet ids.
 */
export function extractAllBulletIds(
  experience: Array<{
    children: Array<{
      children: Array<{ id: string }>;
    }>;
  }>,
): Set<string> {
  const ids = new Set<string>();

  for (const company of experience) {
    for (const position of company.children) {
      for (const bullet of position.children) {
        ids.add(bullet.id);
      }
    }
  }

  return ids;
}
