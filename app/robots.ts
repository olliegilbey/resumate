import { MetadataRoute } from 'next'
import resumeData from '@/data/resume-data.json'

/**
 * Dynamic robots.txt generation
 * Pulls domain from resume data for sitemap URL
 * Blocks scrapers while allowing legitimate search engines
 */
export default function robots(): MetadataRoute.Robots {
  const domain = resumeData.personal.website || 'yourdomain.com'
  const sitemapUrl = domain.startsWith('http')
    ? `${domain}/sitemap.xml`
    : `https://${domain}/sitemap.xml`

  return {
    rules: [
      // Allow good search engines
      {
        userAgent: ['Googlebot', 'Bingbot', 'Slurp', 'DuckDuckBot', 'Baiduspider', 'YandexBot'],
        allow: '/',
        disallow: '/api/',
      },
      // Block common scrapers and harvesters (must come before wildcard)
      {
        userAgent: [
          'EmailCollector',
          'EmailSiphon',
          'WebBandit',
          'EmailWolf',
          'ExtractorPro',
          'CopyRightCheck',
          'Crescent',
          'SiteSucker',
          'Teleport',
          'TeleportPro',
          'WebStripper',
          'WebCopier',
          'WebReaper',
          'WebSauger',
          'Website Quester',
          'WebZIP',
          'Wget',
          'Offline Explorer',
          'HTTrack',
          'Microsoft.URL.Control',
          'penthesilea',
        ],
        disallow: '/',
      },
      // Default: allow most pages but block sensitive areas
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/resume/view'],
        crawlDelay: 10,
      },
    ],
    sitemap: sitemapUrl,
  }
}
