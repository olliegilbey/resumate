/**
 * Bullet Selection Algorithm
 *
 * TypeScript port of Rust selector logic from crates/resume-core/src/selector.rs
 * Applies diversity constraints to AI-scored bullets.
 */

import type { Bullet, Company, Position, ResumeData } from '@/lib/types/generated-resume'
import type { ScoredBulletId } from './output-parser'

/**
 * Configuration for bullet selection
 * Matches Rust SelectionConfig
 */
export interface SelectionConfig {
  /** Maximum total bullets (ceiling - may select fewer) */
  maxBullets: number
  /** Maximum bullets per company (for diversity) */
  maxPerCompany?: number
  /** Minimum bullets per company (avoid single-bullet companies) */
  minPerCompany?: number
  /** Maximum bullets per position */
  maxPerPosition?: number
}

/**
 * Selected bullet with full context
 * Must match ScoredBullet in Rust for WASM compatibility
 */
export interface SelectedBullet {
  bullet: Bullet
  score: number
  companyId: string
  companyName: string | null | undefined
  companyDescription: string | null | undefined
  companyLink: string | null | undefined
  companyDateStart: string
  companyDateEnd: string | null | undefined
  companyLocation: string | null | undefined
  positionId: string
  positionName: string
  positionDescription: string | null | undefined
  positionDateStart: string
  positionDateEnd: string | null | undefined
}

/**
 * Default selection config values
 */
export const DEFAULT_SELECTION_CONFIG: SelectionConfig = {
  maxBullets: 24,
  maxPerCompany: 6,
  minPerCompany: 2, // Avoid standalone single bullets
  maxPerPosition: 4,
}

/**
 * Select top bullets from AI scores applying diversity constraints
 *
 * Algorithm (matches Rust apply_diversity_constraints):
 * 1. Build full bullet objects from resume data + AI scores
 * 2. Sort by score descending
 * 3. Select bullets while respecting per-company and per-position limits
 * 4. Remove companies with fewer than minPerCompany bullets
 *
 * @param resumeData - Full resume data
 * @param aiScores - Bullet ID to score map from AI
 * @param config - Selection configuration
 */
export function selectBulletsWithConstraints(
  resumeData: ResumeData,
  aiScores: Map<string, number>,
  config: SelectionConfig = DEFAULT_SELECTION_CONFIG
): SelectedBullet[] {
  // Step 1: Build all bullet candidates with scores
  const allBullets: SelectedBullet[] = []

  for (const company of resumeData.experience) {
    for (const position of company.children) {
      for (const bullet of position.children) {
        const score = aiScores.get(bullet.id)
        if (score === undefined) continue // AI didn't score this bullet

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
        })
      }
    }
  }

  // Step 2: Sort by score descending
  allBullets.sort((a, b) => b.score - a.score)

  // Step 3: Apply diversity constraints (matches Rust apply_diversity_constraints)
  const selected = applyDiversityConstraints(allBullets, config)

  return selected
}

/**
 * Apply diversity constraints to sorted bullet list
 *
 * Port of Rust function from crates/resume-core/src/selector.rs:142-202
 */
function applyDiversityConstraints(
  sortedBullets: SelectedBullet[],
  config: SelectionConfig
): SelectedBullet[] {
  const { maxBullets, maxPerCompany, maxPerPosition, minPerCompany } = config

  const selected: SelectedBullet[] = []
  const companyCount: Record<string, number> = {}
  const positionCount: Record<string, number> = {}

  for (const bullet of sortedBullets) {
    // Check maxBullets limit (ceiling)
    if (selected.length >= maxBullets) {
      break
    }

    // Check per-company limit
    if (maxPerCompany !== undefined) {
      const count = companyCount[bullet.companyId] || 0
      if (count >= maxPerCompany) {
        continue
      }
    }

    // Check per-position limit
    if (maxPerPosition !== undefined) {
      const count = positionCount[bullet.positionId] || 0
      if (count >= maxPerPosition) {
        continue
      }
    }

    // Add bullet and increment counters
    companyCount[bullet.companyId] = (companyCount[bullet.companyId] || 0) + 1
    positionCount[bullet.positionId] = (positionCount[bullet.positionId] || 0) + 1
    selected.push(bullet)
  }

  // Enforce minimum bullets per company (avoid single-bullet companies)
  if (minPerCompany !== undefined && minPerCompany > 1) {
    // Count bullets per company in selected set
    const finalCompanyCount: Record<string, number> = {}
    for (const bullet of selected) {
      finalCompanyCount[bullet.companyId] = (finalCompanyCount[bullet.companyId] || 0) + 1
    }

    // Filter out companies with fewer than minimum bullets
    const filtered = selected.filter((bullet) => {
      const count = finalCompanyCount[bullet.companyId] || 0
      return count >= minPerCompany
    })

    return filtered
  }

  return selected
}

/**
 * Reorder selected bullets to maintain chronological company order
 * while keeping bullets within each company sorted by score
 *
 * @param selected - Bullets selected by applyDiversityConstraints (score-ordered)
 * @param resumeData - Resume data with company order
 */
export function reorderByCompanyChronology(
  selected: SelectedBullet[],
  resumeData: ResumeData
): SelectedBullet[] {
  // Build company order map from resume data
  const companyOrder = new Map<string, number>()
  resumeData.experience.forEach((company, index) => {
    companyOrder.set(company.id, index)
  })

  // Group selected bullets by company
  const byCompany = new Map<string, SelectedBullet[]>()
  for (const bullet of selected) {
    const existing = byCompany.get(bullet.companyId) || []
    existing.push(bullet)
    byCompany.set(bullet.companyId, existing)
  }

  // Sort each company's bullets by score (already sorted, but ensure)
  for (const bullets of byCompany.values()) {
    bullets.sort((a, b) => b.score - a.score)
  }

  // Build result in company chronological order
  const result: SelectedBullet[] = []
  const sortedCompanyIds = Array.from(byCompany.keys()).sort((a, b) => {
    const orderA = companyOrder.get(a) ?? Infinity
    const orderB = companyOrder.get(b) ?? Infinity
    return orderA - orderB
  })

  for (const companyId of sortedCompanyIds) {
    const bullets = byCompany.get(companyId) || []
    result.push(...bullets)
  }

  return result
}
