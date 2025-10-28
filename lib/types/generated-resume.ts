/**
 * Generated TypeScript types from Rust schemas
 * DO NOT EDIT MANUALLY - Generated via: just types-ts
 * Source: schemas/resume.schema.json
 */

/**
 * Complete resume data structure
 *
 * Top-level container for all resume information. This is the root object stored in resume-data.json.
 */
export interface ResumeData {
  /**
   * List of Education objects - degrees earned (optional)
   */
  education?: Education[] | null
  /**
   * List of Company objects - work experience (required)
   */
  experience: Company[]
  /**
   * Meta footer text for PDF (supports {bullet_count} and {company_count} template variables)
   */
  metaFooter?: string | null
  /**
   * Personal information (required)
   */
  personal: PersonalInfo
  /**
   * List of RoleProfile objects for targeted resume generation (optional)
   */
  roleProfiles?: RoleProfile[] | null
  /**
   * Skills grouped by category (optional)
   */
  skills?: {
    [k: string]: string[]
  } | null
  /**
   * Professional summary 2-3 sentences (optional)
   */
  summary?: string | null
  [k: string]: unknown
}
/**
 * Education entry
 */
export interface Education {
  /**
   * Relevant coursework (optional)
   */
  coursework?: string[] | null
  /**
   * Full degree name (required)
   */
  degree: string
  /**
   * Degree type (required)
   */
  degreeType: string
  /**
   * Institution name (required)
   */
  institution: string
  /**
   * Institution location (required)
   */
  location: string
  /**
   * Clubs, societies, and activities (optional)
   */
  societies?: string[] | null
  /**
   * Year graduated (required)
   */
  year: string
  [k: string]: unknown
}
/**
 * Company - top level of experience hierarchy
 *
 * Represents a company/organization where you worked. Contains positions (roles) held at this company.
 */
export interface Company {
  /**
   * List of Position objects - roles held at this company (required)
   */
  children: Position[]
  /**
   * End date or null for Present (optional)
   */
  dateEnd?: string | null
  /**
   * Start date (required)
   */
  dateStart: string
  /**
   * Detailed description, rarely used at company level (optional)
   */
  description?: string | null
  /**
   * Unique identifier (required)
   */
  id: string
  /**
   * Link to company website (optional)
   */
  link?: string | null
  /**
   * Physical location (optional)
   */
  location?: string | null
  /**
   * Company name (optional)
   */
  name?: string | null
  /**
   * Company importance ranking 1-10, higher = more prestigious (required)
   */
  priority: number
  /**
   * Brief company context (optional)
   */
  summary?: string | null
  /**
   * Category tags for filtering and scoring (required)
   */
  tags: string[]
  [k: string]: unknown
}
/**
 * Position - middle level of hierarchy (role within a company)
 *
 * Represents a specific role/title at a company. Contains bullets (achievements/responsibilities) for this role.
 */
export interface Position {
  /**
   * List of Bullet objects - achievements/responsibilities for this role (required)
   */
  children: Bullet[]
  /**
   * End date or null for Present (optional)
   */
  dateEnd?: string | null
  /**
   * Start date (required)
   */
  dateStart: string
  /**
   * Detailed role description shown in resume (optional)
   */
  description?: string | null
  /**
   * Unique identifier (required)
   */
  id: string
  /**
   * Link to position-specific work or context (optional)
   */
  link?: string | null
  /**
   * Physical location if different from company (optional)
   */
  location?: string | null
  /**
   * Job title or role name (required)
   */
  name: string
  /**
   * Position importance ranking 1-10, higher = more senior/relevant (required)
   */
  priority: number
  /**
   * Brief role summary (optional)
   */
  summary?: string | null
  /**
   * Category tags for filtering and scoring (required)
   */
  tags: string[]
  [k: string]: unknown
}
/**
 * Bullet - leaf level of hierarchy (individual achievement/responsibility)
 *
 * Represents a single resume bullet point. This is the atomic unit of experience that gets selected for targeted resumes.
 */
export interface Bullet {
  /**
   * End date for time-bound achievements (optional)
   */
  dateEnd?: string | null
  /**
   * Start date for time-bound achievements (optional)
   */
  dateStart?: string | null
  /**
   * The actual bullet text that appears on resume (required)
   */
  description: string
  /**
   * Unique identifier (required)
   */
  id: string
  /**
   * Link to work, recording, demo, or additional context (optional)
   */
  link?: string | null
  /**
   * Physical location, rarely used at bullet level (optional)
   */
  location?: string | null
  /**
   * Optional heading or label, rarely used (optional)
   */
  name?: string | null
  /**
   * Bullet importance ranking 1-10, higher = more impressive/relevant (required)
   */
  priority: number
  /**
   * Brief context for this achievement (optional)
   */
  summary?: string | null
  /**
   * Category tags for filtering and scoring (required)
   */
  tags: string[]
  [k: string]: unknown
}
/**
 * Personal information
 */
export interface PersonalInfo {
  /**
   * Email address (optional)
   */
  email?: string | null
  /**
   * GitHub profile URL (optional)
   */
  github?: string | null
  /**
   * LinkedIn profile URL (optional)
   */
  linkedin?: string | null
  /**
   * Current location (optional)
   */
  location?: string | null
  /**
   * Full name (required)
   */
  name: string
  /**
   * Nickname or preferred name (optional)
   */
  nickname?: string | null
  /**
   * Phone number (optional)
   */
  phone?: string | null
  /**
   * Professional tagline or motto (optional)
   */
  tagline?: string | null
  /**
   * Twitter/X profile URL (optional)
   */
  twitter?: string | null
  /**
   * Personal website URL (optional)
   */
  website?: string | null
  [k: string]: unknown
}
/**
 * Role profile for targeted resume generation
 *
 * Defines which tags/skills are most relevant for a specific role type, and how to weight different scoring components when selecting bullets.
 */
export interface RoleProfile {
  /**
   * Optional description of this role type (optional)
   */
  description?: string | null
  /**
   * Unique identifier (required)
   */
  id: string
  /**
   * Display name for this role type (required)
   */
  name: string
  /**
   * Weights for scoring algorithm components (required)
   */
  scoringWeights: ScoringWeights
  /**
   * Map of tag names to relevance weights 0.0-1.0, higher = more relevant (required)
   */
  tagWeights: {
    [k: string]: number
  }
  [k: string]: unknown
}
/**
 * Scoring weights for bullet selection algorithm
 *
 * Defines how to weight different factors when scoring bullets. All weights should sum to approximately 1.0.
 */
export interface ScoringWeights {
  /**
   * Weight for manual priority 0.0-1.0 (required)
   */
  priority: number
  /**
   * Weight for tag relevance 0.0-1.0 (required)
   */
  tagRelevance: number
  [k: string]: unknown
}
