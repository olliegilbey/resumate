#!/usr/bin/env tsx
/**
 * Transform resume-data.json to match new schema
 *
 * Transformations:
 * - companies → experience
 * - company.positions → company.children
 * - position.role → position.name
 * - position.bullets → position.children
 * - bullet.text → bullet.description
 * - dateRange → dateStart/dateEnd (parse date ranges)
 */

import * as fs from 'fs'
import * as path from 'path'

const DATA_PATH = path.join(process.cwd(), 'data', 'resume-data.json')

interface OldBullet {
  id: string
  text: string
  tags: string[]
  priority: number
  metrics?: string
  context?: string
  link?: string
}

interface NewBullet {
  id: string
  name?: string
  location?: string
  dateStart?: string
  dateEnd?: string
  summary?: string
  description: string
  tags: string[]
  priority: number
  link?: string
}

interface OldPosition {
  id: string
  role: string
  dateRange: string
  description?: string
  descriptionTags?: string[]
  descriptionPriority?: number
  descriptionMetrics?: string
  descriptionContext?: string
  bullets: OldBullet[]
  [key: string]: any
}

interface NewPosition {
  id: string
  name: string
  location?: string
  dateStart: string
  dateEnd?: string
  summary?: string
  description?: string
  tags: string[]
  priority: number
  link?: string
  children: NewBullet[]
}

interface OldCompany {
  id: string
  name?: string
  dateRange: string
  location?: string | null
  context?: string
  positions: OldPosition[]
  companyPriority: number
  companyTags: string[]
}

interface NewCompany {
  id: string
  name?: string
  location?: string
  dateStart: string
  dateEnd?: string
  summary?: string
  description?: string
  tags: string[]
  priority: number
  link?: string
  children: NewPosition[]
}

/**
 * Parse date range string to extract start and optional end date
 * Examples:
 * - "January 2024 – April 2025" → { dateStart: "2024-01", dateEnd: "2025-04" }
 * - "March 2019 – April 2021" → { dateStart: "2019-03", dateEnd: "2021-04" }
 * - "January 2024 – Present" → { dateStart: "2024-01", dateEnd: undefined }
 */
function parseDateRange(dateRange: string): { dateStart: string; dateEnd?: string } {
  const monthMap: Record<string, string> = {
    January: '01',
    February: '02',
    March: '03',
    April: '04',
    May: '05',
    June: '06',
    July: '07',
    August: '08',
    September: '09',
    October: '10',
    November: '11',
    December: '12',
  }

  // Handle "Present" or "Current"
  const parts = dateRange.split(/\s*[–-]\s*/)

  const parseDate = (datePart: string): string | undefined => {
    datePart = datePart.trim()

    // Check if it's "Present" or "Current"
    if (/present|current/i.test(datePart)) {
      return undefined
    }

    // Match "Month Year" format
    const match = datePart.match(/^(\w+)\s+(\d{4})$/)
    if (match) {
      const [, month, year] = match
      const monthNum = monthMap[month]
      if (monthNum) {
        return `${year}-${monthNum}`
      }
    }

    // If just a year (fallback)
    const yearMatch = datePart.match(/(\d{4})/)
    if (yearMatch) {
      return yearMatch[1]
    }

    return datePart // Return as-is if we can't parse
  }

  const dateStart = parseDate(parts[0]) || parts[0]
  const dateEnd = parts.length > 1 ? parseDate(parts[1]) : undefined

  return { dateStart, dateEnd }
}

/**
 * Transform old bullet to new bullet structure
 */
function transformBullet(bullet: OldBullet): NewBullet {
  return {
    id: bullet.id,
    name: undefined,
    location: undefined,
    dateStart: undefined,
    dateEnd: undefined,
    summary: undefined,
    description: bullet.text, // KEY CHANGE: text → description
    tags: bullet.tags,
    priority: bullet.priority,
    link: bullet.link,
  }
}

/**
 * Transform old position to new position structure
 */
function transformPosition(position: OldPosition): NewPosition {
  const { dateStart, dateEnd } = parseDateRange(position.dateRange)

  return {
    id: position.id,
    name: position.role, // KEY CHANGE: role → name
    location: undefined,
    dateStart,
    dateEnd,
    summary: undefined,
    description: position.description,
    tags: position.descriptionTags || [],
    priority: position.descriptionPriority || 5,
    link: undefined,
    children: position.bullets.map(transformBullet), // KEY CHANGE: bullets → children
  }
}

/**
 * Transform old company to new company structure
 */
function transformCompany(company: OldCompany): NewCompany {
  const { dateStart, dateEnd } = parseDateRange(company.dateRange)

  return {
    id: company.id,
    name: company.name,
    location: company.location === null ? undefined : company.location,
    dateStart,
    dateEnd,
    summary: undefined,
    description: company.context,
    tags: company.companyTags,
    priority: company.companyPriority,
    link: undefined,
    children: company.positions.map(transformPosition), // KEY CHANGE: positions → children
  }
}

/**
 * Main transformation
 */
async function transformResumeData() {
  console.log('📝 Reading resume-data.json...')
  const rawData = fs.readFileSync(DATA_PATH, 'utf-8')
  const data = JSON.parse(rawData)

  console.log('🔄 Transforming data structure...\n')

  // Transform companies → experience
  if (data.companies) {
    console.log(`   🏢 Transforming ${data.companies.length} companies...`)
    data.experience = data.companies.map(transformCompany)
    delete data.companies
    console.log(`   ✅ Renamed 'companies' → 'experience'\n`)
  }

  // Validate all required fields
  console.log('🔍 Validating required fields...')
  const validationErrors: string[] = []

  for (const company of data.experience || []) {
    for (const position of company.children || []) {
      if (!position.name) {
        validationErrors.push(`Position ${position.id} missing required 'name' field`)
      }
      for (const bullet of position.children || []) {
        if (!bullet.description) {
          validationErrors.push(`Bullet ${bullet.id} missing required 'description' field`)
        }
        if (bullet.priority < 1 || bullet.priority > 10) {
          validationErrors.push(
            `Bullet ${bullet.id} has invalid priority: ${bullet.priority} (must be 1-10)`
          )
        }
      }
      if (position.priority < 1 || position.priority > 10) {
        validationErrors.push(
          `Position ${position.id} has invalid priority: ${position.priority} (must be 1-10)`
        )
      }
    }
    if (company.priority < 1 || company.priority > 10) {
      validationErrors.push(
        `Company ${company.id} has invalid priority: ${company.priority} (must be 1-10)`
      )
    }
  }

  if (validationErrors.length > 0) {
    console.error('\n❌ Validation failed:')
    validationErrors.forEach((err) => console.error(`   - ${err}`))
    process.exit(1)
  }

  console.log('   ✅ All required fields present and valid\n')

  // Write transformed data back
  console.log('💾 Writing transformed data...')
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8')

  console.log('✅ Transformation complete!\n')
  console.log('📋 Summary:')
  console.log(`   - ${data.experience.length} companies`)
  console.log(
    `   - ${data.experience.reduce((sum: number, c: NewCompany) => sum + c.children.length, 0)} positions`
  )
  console.log(
    `   - ${data.experience.reduce(
      (sum: number, c: NewCompany) => sum + c.children.reduce((pSum, p) => pSum + p.children.length, 0),
      0
    )} bullets`
  )
}

// Run transformation
transformResumeData().catch((error) => {
  console.error('❌ Transformation failed:', error)
  process.exit(1)
})
