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
 * Parse markdown links [text](url) and return an array of parts
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

    // Add the link
    parts.push({
      type: 'link',
      content: match[1],
      url: match[2],
      key: keyCounter++
    })

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