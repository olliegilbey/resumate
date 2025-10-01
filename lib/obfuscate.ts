/**
 * Client-side obfuscation utilities to protect contact information from scrapers
 * These methods make it harder for bots to extract data while keeping it accessible to users
 */

/**
 * Base64 encode a string (not for security, just obfuscation)
 * Handles Unicode characters properly
 */
export function encodeContact(data: string): string {
  if (typeof window === 'undefined') return data // Server-side, return as-is
  try {
    // Convert Unicode string to UTF-8 bytes, then to base64
    // btoa only supports Latin1, so we use this workaround for Unicode
    return btoa(unescape(encodeURIComponent(data)))
  } catch {
    return data
  }
}

/**
 * Base64 decode a string
 * Handles Unicode characters properly
 */
export function decodeContact(encoded: string): string {
  if (typeof window === 'undefined') return encoded // Server-side, return as-is
  try {
    // Decode base64 to UTF-8 bytes, then to Unicode string
    return decodeURIComponent(escape(atob(encoded)))
  } catch {
    return encoded
  }
}

/**
 * ROT13 cipher for simple obfuscation
 * Good for email addresses - keeps @ and . readable but scrambles the rest
 */
export function rot13(str: string): string {
  return str.replace(/[a-zA-Z]/g, (char) => {
    const start = char <= 'Z' ? 65 : 97
    return String.fromCharCode(((char.charCodeAt(0) - start + 13) % 26) + start)
  })
}

/**
 * Reverse a string (simple but effective against basic scrapers)
 */
export function reverseString(str: string): string {
  return str.split('').reverse().join('')
}

/**
 * Create an obfuscated mailto link that's revealed on interaction
 */
export function createMailtoLink(email: string): string {
  // Store email in reverse and encoded
  const reversed = reverseString(email)
  const encoded = encodeContact(reversed)
  return encoded
}

/**
 * Decode a mailto link
 */
export function decodeMailtoLink(encoded: string): string {
  const decoded = decodeContact(encoded)
  return reverseString(decoded)
}


/**
 * Split email into parts to avoid plain text in HTML
 * Returns { user, domain }
 */
export function splitEmail(email: string): { user: string; domain: string } {
  const [user, domain] = email.split('@')
  return { user: user || '', domain: domain || '' }
}

