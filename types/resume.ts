export type Tag =
  | 'developer-relations'
  | 'product-management'
  | 'technical-leadership'
  | 'business-development'
  | 'community-building'
  | 'event-management'
  | 'public-speaking'
  | 'technical-writing'
  | 'team-leadership'
  | 'cross-functional'
  | 'strategic-planning'
  | 'blockchain'
  | 'machine-learning'
  | 'growth-engineering'
  | 'data-driven'
  | 'entrepreneurship'
  | 'ecosystem-building'
  | 'content-creation'

export interface BulletPoint {
  id: string
  text: string              // Exact written bullet
  tags: Tag[]
  priority: number          // 1-10, manual ranking
  metrics?: string          // Extracted metrics for emphasis
  context?: string          // Additional detail for future AI use
  link?: string             // Optional link to work/recording/etc
}

export interface Position {
  id: string
  role: string
  dateRange: string
  description: string       // Main description for this role (the primary bullet)
  descriptionTags: Tag[]
  descriptionPriority: number
  descriptionMetrics?: string
  descriptionContext?: string
  descriptionLink?: string
  bullets: BulletPoint[]    // Additional achievement bullets for this role
}

export interface Company {
  id: string
  name: string
  dateRange: string         // Overall: "Jan 2021 - Present" (earliest to latest)
  location?: string         // e.g., "London - Remote"
  context?: string          // Company-level context (e.g., "Web3 Cloud Infrastructure")
  positions: Position[]     // Multiple roles at same company (chronological, newest first)
}

export interface PersonalInfo {
  name: string
  fullName: string
  email: string
  phone: string
  location: string
  citizenship: string[]
  linkedin: string
  github: string
  website: string
}

export interface Education {
  degree: string
  degreeType: string        // BSc, BComm, etc
  institution: string
  location: string
  year: string
  coursework?: string[]
  societies?: string[]
}

export interface Accomplishment {
  id: string
  title: string
  description: string
  year: string
  tags?: Tag[]
}

export interface ResumeData {
  personal: PersonalInfo
  summary: string
  tagline: string           // Footer motto
  companies: Company[]      // Work experience grouped by company
  skills: {
    technical: string[]
    soft: string[]
  }
  education: Education[]
  accomplishments: Accomplishment[]
  interests: string[]
}