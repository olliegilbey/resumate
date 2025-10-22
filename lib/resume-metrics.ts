import { ResumeData, Company } from "@/types/resume"

/**
 * Calculate total number of bullet points across all companies and positions
 */
export function getTotalBullets(companies: Company[]): number {
  return companies.reduce(
    (sum, company) => sum + company.children.reduce(
      (posSum, pos) => posSum + pos.children.length,
      0
    ),
    0
  )
}

/**
 * Calculate total number of positions across all companies
 */
export function getTotalPositions(companies: Company[]): number {
  return companies.reduce(
    (sum, company) => sum + company.children.length,
    0
  )
}

/**
 * Calculate all resume metrics at once
 */
export function getResumeMetrics(data: ResumeData) {
  return {
    totalCompanies: data.experience.length,
    totalPositions: getTotalPositions(data.experience),
    totalBullets: getTotalBullets(data.experience),
  }
}
