/**
 * Generate a vCard (VCF) file content string
 * Following vCard 3.0 specification
 */

/**
 * Escape special characters per vCard 3.0 spec
 * Required escaping: backslash, semicolon, comma, newlines
 */
function escapeVCardText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')   // Backslash must be escaped first
    .replace(/;/g, '\\;')      // Semicolon
    .replace(/,/g, '\\,')      // Comma
    .replace(/\r/g, '')        // Remove carriage returns
    .replace(/\n/g, '\\n')     // Escape newlines
}

export interface VCardData {
  firstName: string
  lastName: string
  fullName: string
  email?: string | string[] // Can be single email or array of emails
  phone?: string
  url?: string
  organization?: string
  title?: string
  address?: {
    street?: string
    city?: string
    region?: string
    postalCode?: string
    country?: string
  }
  note?: string
  linkedin?: string
  github?: string
}

export function generateVCard(data: VCardData): string {
  const lines: string[] = []

  // vCard header
  lines.push('BEGIN:VCARD')
  lines.push('VERSION:3.0')

  // Name fields (escaped per vCard 3.0 spec)
  lines.push(`N:${escapeVCardText(data.lastName)};${escapeVCardText(data.firstName)};;;`)
  lines.push(`FN:${escapeVCardText(data.fullName)}`)

  // Organization and title
  if (data.organization) {
    lines.push(`ORG:${escapeVCardText(data.organization)}`)
  }
  if (data.title) {
    lines.push(`TITLE:${escapeVCardText(data.title)}`)
  }

  // Contact information
  if (data.email) {
    // Handle multiple emails (first one is preferred)
    const emails = Array.isArray(data.email) ? data.email : [data.email]
    emails.forEach((email, index) => {
      const escapedEmail = escapeVCardText(email)
      if (index === 0) {
        // First email is marked as preferred
        lines.push(`EMAIL;TYPE=INTERNET,PREF:${escapedEmail}`)
      } else {
        lines.push(`EMAIL;TYPE=INTERNET:${escapedEmail}`)
      }
    })
  }
  if (data.phone) {
    // Clean phone number (remove spaces, dashes for proper formatting)
    const cleanPhone = data.phone.replace(/[\s-]/g, '')
    lines.push(`TEL;TYPE=CELL:${cleanPhone}`)
  }

  // Address (each component must be escaped separately)
  if (data.address) {
    const { street = '', city = '', region = '', postalCode = '', country = '' } = data.address
    const escapedStreet = escapeVCardText(street)
    const escapedCity = escapeVCardText(city)
    const escapedRegion = escapeVCardText(region)
    const escapedPostalCode = escapeVCardText(postalCode)
    const escapedCountry = escapeVCardText(country)
    lines.push(`ADR;TYPE=WORK:;;${escapedStreet};${escapedCity};${escapedRegion};${escapedPostalCode};${escapedCountry}`)
  }

  // URLs
  if (data.url) {
    lines.push(`URL:${data.url}`)
  }
  if (data.linkedin) {
    const linkedinUrl = data.linkedin.trim().match(/^https?:\/\//i)
      ? data.linkedin.trim()
      : `https://linkedin.com/in/${encodeURIComponent(data.linkedin.trim().replace(/^[@/]+/, ''))}`
    lines.push(`URL;TYPE=LinkedIn:${linkedinUrl}`)
  }
  if (data.github) {
    const githubUrl = data.github.trim().match(/^https?:\/\//i)
      ? data.github.trim()
      : `https://github.com/${encodeURIComponent(data.github.trim().replace(/^[@/]+/, ''))}`
    lines.push(`URL;TYPE=GitHub:${githubUrl}`)
  }

  // Note (escape special characters)
  if (data.note) {
    lines.push(`NOTE:${escapeVCardText(data.note)}`)
  }

  // vCard footer
  lines.push('END:VCARD')

  // Join with CRLF (required by vCard spec)
  return lines.join('\r\n')
}

/**
 * Download a vCard file
 */
export function downloadVCard(vcardContent: string, filename: string = 'contact.vcf'): void {
  // Create a Blob with the vCard content
  const blob = new Blob([vcardContent], { type: 'text/vcard;charset=utf-8' })
  
  // Create a temporary download link
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  
  // Trigger download
  document.body.appendChild(link)
  link.click()
  
  // Cleanup
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

/**
 * Generate and download a vCard in one step
 */
export function generateAndDownloadVCard(data: VCardData, filename?: string): void {
  const vcardContent = generateVCard(data)
  downloadVCard(vcardContent, filename)
}