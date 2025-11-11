import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface TextPart {
  type: 'text' | 'link'
  content: string
  url?: string
  key: number
}

/**
 * Validate URL protocol to prevent XSS attacks
 * Only allows https, http, and mailto protocols
 */
function isValidProtocol(url: string): boolean {
  return /^(https?|mailto):/i.test(url)
}

/**
 * Parse markdown links [text](url) and return an array of parts
 * Sanitizes URLs to prevent XSS attacks via javascript: or data: protocols
 */
export function parseMarkdownLinks(text: string): TextPart[] {
  const parts: TextPart[] = []
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g
  let lastIndex = 0
  let match
  let keyCounter = 0

  while ((match = regex.exec(text)) !== null) {
    // Add text before the link
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex, match.index),
        key: keyCounter++
      })
    }

    const url = match[2]

    // Validate URL protocol - if invalid, render as plain text instead of link
    if (isValidProtocol(url)) {
      parts.push({
        type: 'link',
        content: match[1],
        url: url,
        key: keyCounter++
      })
    } else {
      // Invalid protocol - render as plain text to prevent XSS
      parts.push({
        type: 'text',
        content: match[1],
        key: keyCounter++
      })
    }

    lastIndex = regex.lastIndex
  }

  // Add remaining text after the last link
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.substring(lastIndex),
      key: keyCounter++
    })
  }

  return parts.length > 0 ? parts : [{ type: 'text', content: text, key: 0 }]
}
// Test TS change
