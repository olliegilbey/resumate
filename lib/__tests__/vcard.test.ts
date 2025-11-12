import { describe, it, expect } from 'vitest'
import { generateVCard, type VCardData } from '../vcard'

describe('vCard Generation', () => {
  describe('Basic vCard Structure', () => {
    it('generates valid vCard with minimal data', () => {
      const data: VCardData = {
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
      }

      const vcard = generateVCard(data)

      expect(vcard).toContain('BEGIN:VCARD')
      expect(vcard).toContain('VERSION:3.0')
      expect(vcard).toContain('N:Doe;John;;;')
      expect(vcard).toContain('FN:John Doe')
      expect(vcard).toContain('END:VCARD')
    })

    it('uses CRLF line endings per vCard spec', () => {
      const data: VCardData = {
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
      }

      const vcard = generateVCard(data)

      // Should use \r\n, not just \n
      expect(vcard).toContain('\r\n')
      expect(vcard.split('\r\n').length).toBeGreaterThan(3)
    })

    it('includes all required vCard 3.0 fields', () => {
      const data: VCardData = {
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
      }

      const vcard = generateVCard(data)

      // Required fields for vCard 3.0
      expect(vcard).toMatch(/BEGIN:VCARD/)
      expect(vcard).toMatch(/VERSION:3\.0/)
      expect(vcard).toMatch(/N:/)
      expect(vcard).toMatch(/FN:/)
      expect(vcard).toMatch(/END:VCARD/)
    })
  })

  describe('Name Handling', () => {
    it('uses nickname for display name when provided', () => {
      const data: VCardData = {
        firstName: 'William',
        lastName: 'Smith',
        fullName: 'William Smith',
        nickname: 'Bill',
      }

      const vcard = generateVCard(data)

      expect(vcard).toContain('N:Smith;William;;;')
      expect(vcard).toContain('FN:Bill Smith') // Should use nickname
      expect(vcard).not.toContain('FN:William Smith')
    })

    it('uses fullName when no nickname provided', () => {
      const data: VCardData = {
        firstName: 'William',
        lastName: 'Smith',
        fullName: 'William Smith',
      }

      const vcard = generateVCard(data)

      expect(vcard).toContain('FN:William Smith')
    })

    it('handles names with special characters', () => {
      const data: VCardData = {
        firstName: 'François',
        lastName: 'O\'Brien',
        fullName: 'François O\'Brien',
      }

      const vcard = generateVCard(data)

      expect(vcard).toContain('François')
      expect(vcard).toContain('O\'Brien')
    })
  })

  describe('Contact Information', () => {
    it('includes single email address', () => {
      const data: VCardData = {
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        email: 'john@example.com',
      }

      const vcard = generateVCard(data)

      expect(vcard).toContain('EMAIL;TYPE=INTERNET,PREF:john@example.com')
    })

    it('handles multiple email addresses', () => {
      const data: VCardData = {
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        email: ['john@example.com', 'john.doe@work.com'],
      }

      const vcard = generateVCard(data)

      expect(vcard).toContain('EMAIL;TYPE=INTERNET,PREF:john@example.com')
      expect(vcard).toContain('EMAIL;TYPE=INTERNET:john.doe@work.com')
    })

    it('includes phone number', () => {
      const data: VCardData = {
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        phone: '+1 (555) 123-4567',
      }

      const vcard = generateVCard(data)

      // Should clean phone number (remove spaces and dashes)
      expect(vcard).toContain('TEL;TYPE=CELL:+1(555)1234567')
    })

    it('cleans phone number formatting', () => {
      const testCases = [
        { input: '+1-555-123-4567', expected: '+15551234567' },
        { input: '555 123 4567', expected: '5551234567' },
        { input: '(555) 123-4567', expected: '(555)1234567' },
      ]

      for (const { input, expected } of testCases) {
        const data: VCardData = {
          firstName: 'John',
          lastName: 'Doe',
          fullName: 'John Doe',
          phone: input,
        }

        const vcard = generateVCard(data)
        expect(vcard).toContain(`TEL;TYPE=CELL:${expected}`)
      }
    })

    it('includes website URL', () => {
      const data: VCardData = {
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        url: 'https://johndoe.com',
      }

      const vcard = generateVCard(data)

      expect(vcard).toContain('URL:https://johndoe.com')
    })
  })

  describe('Social Media Links', () => {
    it('generates LinkedIn URL from username', () => {
      const data: VCardData = {
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        linkedin: 'johndoe',
      }

      const vcard = generateVCard(data)

      expect(vcard).toContain('URL;TYPE=LinkedIn:https://linkedin.com/in/johndoe')
    })

    it('uses full LinkedIn URL if provided', () => {
      const data: VCardData = {
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        linkedin: 'https://linkedin.com/in/john-doe-123',
      }

      const vcard = generateVCard(data)

      expect(vcard).toContain('URL;TYPE=LinkedIn:https://linkedin.com/in/john-doe-123')
    })

    it('strips @ and / from LinkedIn username', () => {
      const data: VCardData = {
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        linkedin: '@johndoe',
      }

      const vcard = generateVCard(data)

      expect(vcard).toContain('URL;TYPE=LinkedIn:https://linkedin.com/in/johndoe')
    })

    it('generates GitHub URL from username', () => {
      const data: VCardData = {
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        github: 'johndoe',
      }

      const vcard = generateVCard(data)

      expect(vcard).toContain('URL;TYPE=GitHub:https://github.com/johndoe')
    })

    it('uses full GitHub URL if provided', () => {
      const data: VCardData = {
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        github: 'https://github.com/john-doe',
      }

      const vcard = generateVCard(data)

      expect(vcard).toContain('URL;TYPE=GitHub:https://github.com/john-doe')
    })

    it('handles usernames with special characters', () => {
      const data: VCardData = {
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        github: 'john-doe_123',
      }

      const vcard = generateVCard(data)

      expect(vcard).toContain('URL;TYPE=GitHub:https://github.com/john-doe_123')
    })
  })

  describe('Organization and Title', () => {
    it('includes organization', () => {
      const data: VCardData = {
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        organization: 'Acme Corp',
      }

      const vcard = generateVCard(data)

      expect(vcard).toContain('ORG:Acme Corp')
    })

    it('includes title', () => {
      const data: VCardData = {
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        title: 'Senior Engineer',
      }

      const vcard = generateVCard(data)

      expect(vcard).toContain('TITLE:Senior Engineer')
    })

    it('includes both organization and title', () => {
      const data: VCardData = {
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        organization: 'Acme Corp',
        title: 'Senior Engineer',
      }

      const vcard = generateVCard(data)

      expect(vcard).toContain('ORG:Acme Corp')
      expect(vcard).toContain('TITLE:Senior Engineer')
    })
  })

  describe('Address Handling', () => {
    it('includes complete address', () => {
      const data: VCardData = {
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        address: {
          street: '123 Main St',
          city: 'Springfield',
          region: 'IL',
          postalCode: '62701',
          country: 'USA',
        },
      }

      const vcard = generateVCard(data)

      expect(vcard).toContain('ADR;TYPE=WORK:;;123 Main St;Springfield;IL;62701;USA')
    })

    it('handles partial address', () => {
      const data: VCardData = {
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        address: {
          city: 'Springfield',
          region: 'IL',
        },
      }

      const vcard = generateVCard(data)

      expect(vcard).toContain('ADR;TYPE=WORK:;;;Springfield;IL;;')
    })

    it('handles empty address components', () => {
      const data: VCardData = {
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        address: {},
      }

      const vcard = generateVCard(data)

      expect(vcard).toContain('ADR;TYPE=WORK:;;;;;;')
    })
  })

  describe('Special Character Escaping', () => {
    it('escapes semicolons in names', () => {
      const data: VCardData = {
        firstName: 'John;Jr',
        lastName: 'Doe',
        fullName: 'John;Jr Doe',
      }

      const vcard = generateVCard(data)

      expect(vcard).toContain('N:Doe;John\\;Jr;;;')
    })

    it('escapes commas in names', () => {
      const data: VCardData = {
        firstName: 'John',
        lastName: 'Doe, III',
        fullName: 'John Doe, III',
      }

      const vcard = generateVCard(data)

      expect(vcard).toContain('N:Doe\\, III;John;;;')
    })

    it('escapes backslashes', () => {
      const data: VCardData = {
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        note: 'Works at C:\\Program Files',
      }

      const vcard = generateVCard(data)

      expect(vcard).toContain('NOTE:Works at C:\\\\Program Files')
    })

    it('escapes newlines in notes', () => {
      const data: VCardData = {
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        note: 'Line 1\nLine 2\nLine 3',
      }

      const vcard = generateVCard(data)

      expect(vcard).toContain('NOTE:Line 1\\nLine 2\\nLine 3')
    })

    it('handles multiple special characters', () => {
      const data: VCardData = {
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        organization: 'Company; Inc, LLC\\Ltd',
      }

      const vcard = generateVCard(data)

      expect(vcard).toContain('ORG:Company\\; Inc\\, LLC\\\\Ltd')
    })
  })

  describe('Comprehensive vCard', () => {
    it('generates complete vCard with all fields', () => {
      const data: VCardData = {
        firstName: 'Oliver',
        lastName: 'Gilbey',
        fullName: 'Oliver Gilbey',
        nickname: 'Ollie',
        email: ['ollie@example.com', 'oliver@work.com'],
        phone: '+44 7700 900000',
        url: 'https://ollie.gg',
        organization: 'Tech Corp',
        title: 'Senior Engineer',
        address: {
          street: '123 Tech Street',
          city: 'London',
          region: 'Greater London',
          postalCode: 'SW1A 1AA',
          country: 'UK',
        },
        linkedin: 'olivergilbey',
        github: 'olliegilbey',
        note: 'Software engineer specializing in distributed systems',
      }

      const vcard = generateVCard(data)

      // Verify structure
      expect(vcard).toContain('BEGIN:VCARD')
      expect(vcard).toContain('VERSION:3.0')
      expect(vcard).toContain('END:VCARD')

      // Verify all fields
      expect(vcard).toContain('N:Gilbey;Oliver;;;')
      expect(vcard).toContain('FN:Ollie Gilbey')
      expect(vcard).toContain('EMAIL;TYPE=INTERNET,PREF:ollie@example.com')
      expect(vcard).toContain('EMAIL;TYPE=INTERNET:oliver@work.com')
      expect(vcard).toContain('TEL;TYPE=CELL:+447700900000')
      expect(vcard).toContain('URL:https://ollie.gg')
      expect(vcard).toContain('ORG:Tech Corp')
      expect(vcard).toContain('TITLE:Senior Engineer')
      expect(vcard).toContain('ADR;TYPE=WORK:;;123 Tech Street;London;Greater London;SW1A 1AA;UK')
      expect(vcard).toContain('URL;TYPE=LinkedIn:https://linkedin.com/in/olivergilbey')
      expect(vcard).toContain('URL;TYPE=GitHub:https://github.com/olliegilbey')
      expect(vcard).toContain('NOTE:Software engineer specializing in distributed systems')
    })

    it('produces valid vCard that can be parsed', () => {
      const data: VCardData = {
        firstName: 'Test',
        lastName: 'User',
        fullName: 'Test User',
        email: 'test@example.com',
      }

      const vcard = generateVCard(data)

      // Basic structure validation
      const lines = vcard.split('\r\n')
      expect(lines[0]).toBe('BEGIN:VCARD')
      expect(lines[1]).toBe('VERSION:3.0')
      expect(lines[lines.length - 1]).toBe('END:VCARD')

      // Each line should be properly formatted (KEY:VALUE or KEY;PARAM:VALUE)
      for (let i = 2; i < lines.length - 1; i++) {
        expect(lines[i]).toMatch(/^[A-Z]+[;:]/)
      }
    })
  })

  describe('Edge Cases', () => {
    it('handles empty strings', () => {
      const data: VCardData = {
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        organization: '',
        title: '',
      }

      const vcard = generateVCard(data)

      // Empty strings should not create fields
      expect(vcard).not.toContain('ORG:')
      expect(vcard).not.toContain('TITLE:')
    })

    it('handles whitespace-only strings', () => {
      const data: VCardData = {
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        linkedin: '   ',
        github: '\t\n',
      }

      const vcard = generateVCard(data)

      // Should still generate URLs (trim handles whitespace)
      const lines = vcard.split('\r\n')
      const hasLinkedIn = lines.some(line => line.includes('LinkedIn'))
      const hasGitHub = lines.some(line => line.includes('GitHub'))

      expect(hasLinkedIn).toBe(true)
      expect(hasGitHub).toBe(true)
    })

    it('handles very long text fields', () => {
      const longNote = 'A'.repeat(500)
      const data: VCardData = {
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        note: longNote,
      }

      const vcard = generateVCard(data)

      expect(vcard).toContain(`NOTE:${longNote}`)
    })

    it('handles Unicode characters', () => {
      const data: VCardData = {
        firstName: '李',
        lastName: '明',
        fullName: '李明',
        organization: '科技公司',
        note: 'Emoji test 🚀 ✨ 🎉',
      }

      const vcard = generateVCard(data)

      expect(vcard).toContain('李')
      expect(vcard).toContain('明')
      expect(vcard).toContain('科技公司')
      expect(vcard).toContain('🚀')
    })
  })
})
