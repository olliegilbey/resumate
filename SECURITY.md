# Security Policy

Multi-layered security protecting contact information while maintaining accessibility for legitimate users and search engines.

## Protection Layers

### 1. Server-Side Only Contact Info

Contact information stored in server env vars and only delivered through protected API endpoints after Cloudflare Turnstile CAPTCHA verification - never embedded in static HTML/JavaScript bundles.

### 2. Bot Detection & Rate Limiting (`/middleware.ts`)

- Blocks suspicious user agents (curl, wget, generic scrapers)
- Allows search engines and social media preview bots
- 30 req/min per IP (100 req/min for Googlebot)
- Security headers: CSP, X-Frame-Options, X-Content-Type-Options

## Limitations

Cannot prevent determined attackers with headless browsers, human scrapers, screenshot bots, or distributed proxy attacks.

## Reporting

To report security vulnerabilities, please open a GitHub issue or contact via the site.
