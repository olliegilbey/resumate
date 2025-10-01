#!/usr/bin/env node

/**
 * Fetch resume data from GitHub Gist
 *
 * This script runs before build to fetch the latest resume data from a private gist.
 * If RESUME_DATA_GIST_URL is not set, it skips (uses local data/resume-data.json).
 *
 * Usage:
 *   - Local: Set RESUME_DATA_GIST_URL in .env.local
 *   - Vercel: Set RESUME_DATA_GIST_URL in environment variables
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Load .env.local if it exists (for local development)
try {
  require('dotenv').config({ path: '.env.local' });
} catch (error) {
  // dotenv not available (production build), use process.env directly
}

const GIST_URL = process.env.RESUME_DATA_GIST_URL;
const OUTPUT_PATH = path.join(process.cwd(), 'data', 'resume-data.json');

if (!GIST_URL) {
  console.log('ℹ️  RESUME_DATA_GIST_URL not set, using local data/resume-data.json');
  process.exit(0);
}

console.log('📥 Fetching resume data from gist...');

https.get(GIST_URL, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode !== 200) {
      console.error(`❌ Failed to fetch gist: HTTP ${res.statusCode}`);
      console.error('Response:', data);
      process.exit(1);
    }

    try {
      // Validate JSON
      JSON.parse(data);

      // Write to file
      fs.writeFileSync(OUTPUT_PATH, data, 'utf8');
      console.log('✅ Resume data fetched successfully from gist');
      console.log(`   Saved to: ${OUTPUT_PATH}`);
    } catch (error) {
      console.error('❌ Invalid JSON from gist:', error.message);
      process.exit(1);
    }
  });
}).on('error', (error) => {
  console.error('❌ Error fetching gist:', error.message);
  process.exit(1);
});
