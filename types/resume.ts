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

import type {
  Bullet as GeneratedBullet,
  PersonalInfo as GeneratedPersonalInfo,
  ResumeData as GeneratedResumeData,
} from "../lib/types/generated-resume";

export type {
  Company,
  Education,
  Position,
  RoleProfile,
  ScoringWeights,
} from "../lib/types/generated-resume";

/**
 * Optional fields present in the real gist data that haven't yet been folded
 * into the Rust schema. Kept in a separate interface so the canonical
 * generated type stays untouched; update Rust + regenerate if any of these
 * graduate to required fields.
 */
export interface PersonalInfoExtensions {
  calendar?: string;
  fullName?: string;
}

export interface ResumeDataExtensions {
  interests?: string[];
}

export interface PersonalInfo extends GeneratedPersonalInfo, PersonalInfoExtensions {}

export interface ResumeData extends GeneratedResumeData, ResumeDataExtensions {
  personal: PersonalInfo;
}

// Backwards compatibility aliases
export type Bullet = GeneratedBullet;
export type BulletPoint = GeneratedBullet;
export type Tag = string;
