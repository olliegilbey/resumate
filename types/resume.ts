/**
 * Resume Types - Re-exported from Generated Schema
 *
 * These types are generated from Rust schemas via:
 * 1. Rust types (crates/shared-types/src/lib.rs)
 * 2. JSON Schema generation (npm run schemas:emit)
 * 3. TypeScript type generation (npm run types:gen)
 *
 * DO NOT manually edit. To update types:
 * - Edit Rust types
 * - Run: npm run schemas:emit && npm run types:gen
 */

import type { Bullet as GeneratedBullet } from '../lib/types/generated-resume'

export type {
  ResumeData,
  Company,
  Education,
  PersonalInfo,
  Position,
  RoleProfile,
  ScoringWeights,
} from '../lib/types/generated-resume'

// Backwards compatibility aliases
export type Bullet = GeneratedBullet
export type BulletPoint = GeneratedBullet
export type Tag = string
