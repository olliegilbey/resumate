import { vi } from 'vitest'

/**
 * Mock environment variables for testing
 * IMPORTANT: Never commit real contact info to public repo
 */

interface MockEnvConfig {
  turnstileSecret?: string
  contactEmailPersonal?: string
  contactEmailProfessional?: string
  contactPhone?: string
  nodeEnv?: string
}

const originalEnv: Record<string, string | undefined> = {}

/**
 * Set mock environment variables
 * Use before tests that require env vars
 */
export function setMockEnv(config: MockEnvConfig = {}) {
  const defaults: MockEnvConfig = {
    turnstileSecret: 'test-turnstile-secret-key',
    contactEmailPersonal: 'test@example.com',
    contactEmailProfessional: 'test.work@example.com',
    contactPhone: '+1234567890',
    nodeEnv: 'test',
  }

  const merged = { ...defaults, ...config }

  // Store originals
  originalEnv.TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY
  originalEnv.CONTACT_EMAIL_PERSONAL = process.env.CONTACT_EMAIL_PERSONAL
  originalEnv.CONTACT_EMAIL_PROFESSIONAL = process.env.CONTACT_EMAIL_PROFESSIONAL
  originalEnv.CONTACT_PHONE = process.env.CONTACT_PHONE
  originalEnv.NODE_ENV = process.env.NODE_ENV

  // Set mocks
  if (merged.turnstileSecret !== undefined) {
    process.env.TURNSTILE_SECRET_KEY = merged.turnstileSecret
  }
  if (merged.contactEmailPersonal !== undefined) {
    process.env.CONTACT_EMAIL_PERSONAL = merged.contactEmailPersonal
  }
  if (merged.contactEmailProfessional !== undefined) {
    process.env.CONTACT_EMAIL_PROFESSIONAL = merged.contactEmailProfessional
  }
  if (merged.contactPhone !== undefined) {
    process.env.CONTACT_PHONE = merged.contactPhone
  }
  if (merged.nodeEnv !== undefined) {
    // @ts-ignore - NODE_ENV is read-only but we need to mock it for tests
    process.env.NODE_ENV = merged.nodeEnv
  }
}

/**
 * Restore original environment variables
 * Use in afterEach to clean up
 */
export function restoreMockEnv() {
  Object.keys(originalEnv).forEach((key) => {
    if (originalEnv[key] === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = originalEnv[key]
    }
  })
}

/**
 * Clear specific env var (simulate missing config)
 */
export function clearEnvVar(key: string) {
  delete process.env[key]
}
