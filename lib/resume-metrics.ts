import { ResumeData, Company } from "@/types/resume"

/**
 * Calculate total number of bullet points across all companies and positions
 */
export function getTotalBullets(companies: Company[]): number {
  return companies.reduce(
    (sum, company) => sum + company.positions.reduce(
      (posSum, pos) => posSum + pos.bullets.length,
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
    (sum, company) => sum + company.positions.length,
    0
  )
}

/**
 * Calculate all resume metrics at once
 */
export function getResumeMetrics(data: ResumeData) {
  return {
    totalCompanies: data.companies.length,
    totalPositions: getTotalPositions(data.companies),
    totalBullets: getTotalBullets(data.companies),
  }
}
