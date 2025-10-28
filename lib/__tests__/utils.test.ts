import { describe, it, expect } from 'vitest'
import { cn, parseMarkdownLinks } from '../utils'

describe('utils', () => {
  describe('cn (className utility)', () => {
    it('merges class names correctly', () => {
      const result = cn('class1', 'class2')
      expect(result).toBe('class1 class2')
    })

    it('handles conditional classes', () => {
      const result = cn('base', false && 'hidden', true && 'visible')
      expect(result).toBe('base visible')
    })

    it('merges Tailwind classes correctly', () => {
      const result = cn('px-2 py-1', 'px-4')
      expect(result).toBe('py-1 px-4') // Later px-4 overrides px-2
    })

    it('handles arrays of classes', () => {
      const result = cn(['class1', 'class2'], 'class3')
      expect(result).toBe('class1 class2 class3')
    })

    it('handles empty input', () => {
      const result = cn()
      expect(result).toBe('')
    })

    it('filters out falsy values', () => {
      const result = cn('base', null, undefined, false, '', 'active')
      expect(result).toBe('base active')
    })
  })

  describe('parseMarkdownLinks', () => {
    it('parses single markdown link', () => {
      const text = 'Check out [my website](https://example.com)'
      const parts = parseMarkdownLinks(text)

      expect(parts).toHaveLength(2)
      expect(parts[0]).toEqual({ type: 'text', content: 'Check out ', key: 0 })
      expect(parts[1]).toEqual({
        type: 'link',
        content: 'my website',
        url: 'https://example.com',
        key: 1,
      })
    })

    it('parses multiple markdown links', () => {
      const text = '[Link 1](https://example.com) and [Link 2](https://google.com)'
      const parts = parseMarkdownLinks(text)

      expect(parts).toHaveLength(3)
      expect(parts[0]).toEqual({
        type: 'link',
        content: 'Link 1',
        url: 'https://example.com',
        key: 0,
      })
      expect(parts[1]).toEqual({ type: 'text', content: ' and ', key: 1 })
      expect(parts[2]).toEqual({
        type: 'link',
        content: 'Link 2',
        url: 'https://google.com',
        key: 2,
      })
    })

    it('handles plain text without links', () => {
      const text = 'Just plain text'
      const parts = parseMarkdownLinks(text)

      expect(parts).toHaveLength(1)
      expect(parts[0]).toEqual({ type: 'text', content: 'Just plain text', key: 0 })
    })

    it('handles empty string', () => {
      const text = ''
      const parts = parseMarkdownLinks(text)

      expect(parts).toHaveLength(1)
      expect(parts[0]).toEqual({ type: 'text', content: '', key: 0 })
    })

    it('handles http URLs', () => {
      const text = '[Insecure site](http://example.com)'
      const parts = parseMarkdownLinks(text)

      expect(parts[0]).toEqual({
        type: 'link',
        content: 'Insecure site',
        url: 'http://example.com',
        key: 0,
      })
    })

    it('handles mailto links', () => {
      const text = '[Email me](mailto:test@example.com)'
      const parts = parseMarkdownLinks(text)

      expect(parts[0]).toEqual({
        type: 'link',
        content: 'Email me',
        url: 'mailto:test@example.com',
        key: 0,
      })
    })

    it('sanitizes javascript: protocol (XSS prevention)', () => {
      const text = '[Click me](javascript:alert("XSS"))'
      const parts = parseMarkdownLinks(text)

      // Should render as plain text, not a link
      expect(parts[0]).toEqual({
        type: 'text',
        content: 'Click me',
        key: 0,
      })
    })

    it('sanitizes data: protocol (XSS prevention)', () => {
      const text = '[Click me](data:text/html,<script>alert("XSS")</script>)'
      const parts = parseMarkdownLinks(text)

      // Should render as plain text, not a link
      expect(parts[0]).toEqual({
        type: 'text',
        content: 'Click me',
        key: 0,
      })
    })

    it('handles text before and after link', () => {
      const text = 'Before [link](https://example.com) after'
      const parts = parseMarkdownLinks(text)

      expect(parts).toHaveLength(3)
      expect(parts[0]).toEqual({ type: 'text', content: 'Before ', key: 0 })
      expect(parts[1]).toEqual({
        type: 'link',
        content: 'link',
        url: 'https://example.com',
        key: 1,
      })
      expect(parts[2]).toEqual({ type: 'text', content: ' after', key: 2 })
    })

    it('handles consecutive links', () => {
      const text = '[Link 1](https://example.com)[Link 2](https://google.com)'
      const parts = parseMarkdownLinks(text)

      expect(parts).toHaveLength(2)
      expect(parts[0]).toEqual({
        type: 'link',
        content: 'Link 1',
        url: 'https://example.com',
        key: 0,
      })
      expect(parts[1]).toEqual({
        type: 'link',
        content: 'Link 2',
        url: 'https://google.com',
        key: 1,
      })
    })

    it('handles special characters in link text', () => {
      const text = '[Visit "My Site"](https://example.com)'
      const parts = parseMarkdownLinks(text)

      expect(parts[0]).toEqual({
        type: 'link',
        content: 'Visit "My Site"',
        url: 'https://example.com',
        key: 0,
      })
    })

    it('handles query parameters in URL', () => {
      const text = '[Search](https://example.com?q=test&page=2)'
      const parts = parseMarkdownLinks(text)

      expect(parts[0]).toEqual({
        type: 'link',
        content: 'Search',
        url: 'https://example.com?q=test&page=2',
        key: 0,
      })
    })

    it('handles anchor links', () => {
      const text = '[Jump to section](https://example.com#section)'
      const parts = parseMarkdownLinks(text)

      expect(parts[0]).toEqual({
        type: 'link',
        content: 'Jump to section',
        url: 'https://example.com#section',
        key: 0,
      })
    })

    it('assigns unique keys to each part', () => {
      const text = '[Link 1](https://a.com) text [Link 2](https://b.com)'
      const parts = parseMarkdownLinks(text)

      const keys = parts.map((p) => p.key)
      const uniqueKeys = new Set(keys)

      expect(uniqueKeys.size).toBe(keys.length) // All keys should be unique
    })

    it('handles malformed markdown gracefully', () => {
      const text = '[Link without closing paren](https://example.com'
      const parts = parseMarkdownLinks(text)

      // Should render as plain text since it's malformed
      expect(parts).toHaveLength(1)
      expect(parts[0].type).toBe('text')
    })

    it('handles brackets without parentheses', () => {
      const text = '[Not a link]'
      const parts = parseMarkdownLinks(text)

      expect(parts).toHaveLength(1)
      expect(parts[0]).toEqual({ type: 'text', content: '[Not a link]', key: 0 })
    })
  })
})
