#!/usr/bin/env node

/**
 * Fetch resume data from GitHub Gist
 *
 * This script runs before build to fetch the latest resume data from a private gist.
 * If RESUME_DATA_GIST_URL is not set, it skips (uses local data/resume-data.json).
 *
 * Usage:
 *   npm run data:pull           # Interactive (prompts if local differs)
 *   npm run data:pull -- --force # Skip prompts (for automation)
 *
 * Environment:
 *   - Local: Set RESUME_DATA_GIST_URL in .env.local
 *   - Vercel: Set RESUME_DATA_GIST_URL in environment variables
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import readline from 'readline';
import dotenv from 'dotenv';

// Load .env.local if it exists (for local development)
try {
  dotenv.config({ path: '.env.local' });
} catch {
  // dotenv not available (production build), use process.env directly
}

const GIST_URL = process.env.RESUME_DATA_GIST_URL;
const OUTPUT_PATH = path.join(process.cwd(), 'data', 'resume-data.json');
const FORCE_MODE = process.argv.includes('--force');

if (!GIST_URL) {
  console.log('ℹ️  RESUME_DATA_GIST_URL not set, using local data/resume-data.json');
  process.exit(0);
}

/**
 * Prompt user for confirmation
 */
function promptUser(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

console.log('📥 Fetching resume data from gist...');

https.get(GIST_URL, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', async () => {
    if (res.statusCode !== 200) {
      console.error(`❌ Failed to fetch gist: HTTP ${res.statusCode}`);
      console.error('Response:', data);
      process.exit(1);
    }

    try {
      // Validate JSON
      JSON.parse(data);

      // Check if local file exists and differs from gist
      if (!FORCE_MODE && fs.existsSync(OUTPUT_PATH)) {
        const localContent = fs.readFileSync(OUTPUT_PATH, 'utf8');

        if (localContent !== data) {
          console.warn('\n⚠️  Warning: Local file differs from gist!');
          console.warn('   This will OVERWRITE your local changes.');

          const confirmed = await promptUser('\nContinue? (y/N): ');

          if (!confirmed) {
            console.log('❌ Aborted. Local file unchanged.');
            process.exit(0);
          }
        }
      }

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
