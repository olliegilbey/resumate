import { vi } from 'vitest'

/**
 * Mock resume data imports for testing
 * Uses real data structure from data/resume-data.json
 * Sanitizes contact info to prevent leakage in public repo
 */

/**
 * Load and sanitize real resume data for tests
 * Replaces sensitive contact info with test values
 */
export async function loadSanitizedResumeData() {
  try {
    // Dynamic import to load actual data structure
    const data = await import('@/data/resume-data.json')
    const resumeData = data.default || data

    // Sanitize personal contact info
    const sanitized = {
      ...resumeData,
      personal: {
        ...resumeData.personal,
        email: 'test@example.com', // Never use real email in tests
        phone: '+1234567890', // Never use real phone in tests
      },
    }

    return sanitized
  } catch (error) {
    console.warn('Could not load resume-data.json, using fixture:', error)
    // Fallback to fixture if data file doesn't exist
    const { mockResumeData } = await import('../fixtures/resume-data.fixture')
    return mockResumeData
  }
}

/**
 * Mock the resume-data.json module
 * Call this in beforeAll/beforeEach to replace imports
 */
export async function mockResumeDataImport() {
  const sanitizedData = await loadSanitizedResumeData()

  vi.mock('@/data/resume-data.json', () => ({
    default: sanitizedData,
  }))

  return sanitizedData
}

/**
 * Unmock resume data imports
 * Call in afterAll to restore
 */
export function unmockResumeDataImport() {
  vi.unmock('@/data/resume-data.json')
}
