# Security & Anti-Scraping Measures

This document outlines the security and anti-scraping measures implemented in Resumate to protect personal contact information.

## Overview

Resumate implements a multi-layered approach to protect contact information from automated scrapers while keeping the site accessible to legitimate users and search engines.

## Protection Layers

### 1. Client-Side Obfuscation (`/lib/obfuscate.ts`)

Contact information (email and phone) is obfuscated using multiple techniques:

- **Base64 Encoding**: Contact data is encoded on the client side
- **String Reversal**: Email and phone are reversed before encoding
- **No Plain Text in HTML**: Contact information is not present in the initial HTML source
- **Client-Side Hydration**: Real contact data only appears after JavaScript executes

**How it works:**
```typescript
// Email is stored reversed and base64 encoded
const obfuscated = createMailtoLink("user@example.com")
// Only decoded when user clicks
const email = decodeMailtoLink(obfuscated)
```

**What this protects against:**
- Simple HTML scrapers that parse source code
- wget/curl requests that don't execute JavaScript
- Basic email harvesting bots

### 2. Server-Side Bot Detection (`/middleware.ts`)

Next.js middleware detects and blocks suspicious user agents:

**Blocked patterns:**
- Generic bot/crawler/spider user agents
- Common scraping tools (curl, wget, python, etc.)
- HTTP clients used by scrapers (axios, httpclient, etc.)

**Allowed bots:**
- Search engines (Google, Bing, etc.)
- Social media preview bots (LinkedIn, Twitter, etc.)
- Messaging apps (WhatsApp, Telegram)

**Behavior:**
- Suspicious bots get 403 Forbidden on sensitive pages
- Legitimate bots can crawl public pages
- All traffic is logged for monitoring

### 3. Rate Limiting (`/middleware.ts`)

In-memory rate limiting protects against aggressive scraping:

- **Default limit**: 30 requests per minute per IP
- **Search engines**: 100 requests per minute (more generous)
- **Response**: 429 Too Many Requests with Retry-After header
- **Cleanup**: Automatic cleanup of old rate limit records

**Production Note:**
For production deployments with multiple instances, consider replacing the in-memory Map with Redis or a similar distributed store.

### 4. Security Headers

All responses include security headers:

- `X-Frame-Options: SAMEORIGIN` - Prevents clickjacking
- `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
- `X-XSS-Protection: 1; mode=block` - Enables XSS filter
- `Referrer-Policy: strict-origin-when-cross-origin` - Controls referrer info

### 5. Robots.txt (`/public/robots.txt`)

Explicitly controls which bots can crawl which pages:

- Search engines allowed on public pages
- Scrapers and email harvesters blocked entirely
- Sensitive pages (e.g., `/resume/view`) disallowed for generic crawlers
- Crawl-delay of 10 seconds for non-whitelisted bots

## Testing the Protection

### Manual Testing

1. **View page source** - Contact info should NOT be in plain text
2. **Inspect Network tab** - Contact info loaded via client-side JS
3. **Disable JavaScript** - Contact info shows "Loading..." placeholders
4. **Test with curl**:
   ```bash
   curl https://yourdomain.com/ -A "Mozilla/5.0"  # Should work
   curl https://yourdomain.com/ -A "PythonBot"    # Should be blocked
   ```

### Rate Limit Testing

```bash
# This should eventually return 429 Too Many Requests
for i in {1..35}; do curl -s https://yourdomain.com/; done
```

## What This Does NOT Protect Against

**Important limitations:**

1. **Determined attackers** - Someone with JavaScript execution can still extract data
2. **Human scrapers** - Manual copy-paste cannot be prevented
3. **Screenshot bots** - Visual scraping tools can capture displayed information
4. **Distributed attacks** - Rate limiting by IP can be bypassed with proxies
5. **AI tools** - Claude, ChatGPT, etc. could extract data if given access

## Best Practices

### For Deployment

1. **Add CAPTCHA for downloads** - Consider adding CAPTCHA for vCard downloads
2. **Monitor logs** - Watch for suspicious patterns in access logs
3. **Use Cloudflare** - Add Cloudflare for DDoS protection and more sophisticated bot detection
4. **Implement Redis** - Replace in-memory rate limiting with Redis for production
5. **Add honeypots** - Include hidden form fields that bots often fill

### For Additional Protection

1. **Cloudflare Turnstile** - Free, privacy-friendly CAPTCHA alternative
2. **reCAPTCHA** - Google's CAPTCHA (less privacy-friendly)
3. **hCaptcha** - Privacy-focused CAPTCHA alternative
4. **Email relay service** - Use a contact form instead of direct email links
5. **OAuth gates** - Require social login for sensitive information

## Privacy Considerations

These measures balance:
- **Protection**: Making it harder for scrapers to harvest data
- **Usability**: Keeping the site accessible to real visitors
- **SEO**: Allowing search engines to index public information
- **Accessibility**: Not breaking screen readers or other assistive tech

## Monitoring

Recommended monitoring:

```bash
# Watch for bot detection in logs
tail -f logs/middleware.log | grep "bot detected"

# Watch for rate limit hits
tail -f logs/middleware.log | grep "Rate limit exceeded"
```

## Updates

- **2025-09-30**: Initial implementation of obfuscation, bot detection, and rate limiting

## Contact

If you find ways to bypass these protections, please reach out responsibly rather than exploiting them.