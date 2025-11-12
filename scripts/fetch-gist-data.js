#!/usr/bin/env node

/**
 * Fetch resume data from GitHub Gist
 *
 * This script runs before build to fetch the latest resume data from a private gist.
 * If RESUME_DATA_GIST_URL is not set, it skips (uses local data/resume-data.json).
 *
 * Usage:
 *   just data-pull           # Interactive (prompts if local differs)
 *   just data-pull -- --force # Skip prompts (for automation)
 *
 * Environment:
 *   - Local: Set RESUME_DATA_GIST_URL in .env.local
 *   - Vercel: Set RESUME_DATA_GIST_URL in environment variables
 */

import { spawnSync } from 'child_process';
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
const TEMPLATE_PATH = path.join(process.cwd(), 'data', 'resume-data-template.json');
const FORCE_MODE = process.argv.includes('--force');
const ALLOW_TEMPLATE = process.argv.includes('--allow-template');
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';

// Production: GIST_URL required
if (IS_PRODUCTION && !GIST_URL) {
  console.error('❌ CRITICAL: RESUME_DATA_GIST_URL not set in production!');
  console.error('::error::Missing required environment variable: RESUME_DATA_GIST_URL');
  console.error('');
  console.error('Set GIST_URL in Vercel environment variables or .env.local');
  process.exit(1);
}

// Development: Allow template fallback with explicit flag
if (!GIST_URL) {
  if (ALLOW_TEMPLATE && fs.existsSync(TEMPLATE_PATH)) {
    console.log('⚠️  Development mode: Using template data (GIST_URL not set)');
    console.log(`   Copying ${TEMPLATE_PATH} → ${OUTPUT_PATH}`);

    const templateContent = fs.readFileSync(TEMPLATE_PATH, 'utf8');

    // Ensure output directory exists
    const outputDir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_PATH, templateContent, 'utf8');
    console.log('✅ Template data copied successfully');
    process.exit(0);
  }

  console.log('ℹ️  RESUME_DATA_GIST_URL not set, using existing local data/resume-data.json');
  console.log('   (Use --allow-template flag to copy template in development)');
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
      console.error(`❌ CRITICAL: Failed to fetch gist: HTTP ${res.statusCode}`);
      console.error('::error::Gist fetch failed');
      console.error('Response:', data);

      if (IS_PRODUCTION) {
        console.error('');
        console.error('Production build cannot proceed without valid gist data.');
        console.error('Check RESUME_DATA_GIST_URL is correct and gist is accessible.');
      }

      process.exit(1);
    }

    try {
      // Step 1: Validate JSON syntax
      JSON.parse(data);
      console.log('✅ JSON syntax valid');

      // Step 2: Write to temp file for schema validation
      const tempFile = OUTPUT_PATH + '.tmp';
      fs.writeFileSync(tempFile, data, 'utf8');
      console.log('✅ Data file created');

      // Step 3: Validate against schema
      const validateResult = spawnSync('node', ['scripts/validate-compendium.mjs', tempFile], {
        stdio: ['inherit', 'pipe', 'pipe'],
        encoding: 'utf8'
      });

      if (validateResult.status !== 0) {
        fs.unlinkSync(tempFile);
        console.error('❌ CRITICAL: Gist data validation failed');
        console.error('::error::Schema validation failed');
        console.error(validateResult.stderr);
        console.error('');

        if (IS_PRODUCTION) {
          console.error('Production build cannot proceed with invalid data.');
          console.error('Fix gist data and retry build.');
        } else {
          console.error('⚠️  Gist contains invalid data! Please fix manually.');
        }

        process.exit(1);
      }

      fs.unlinkSync(tempFile);
      console.log('✅ Schema validation passed');

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

      // Step 4: Ensure output directory exists
      const outputDir = path.dirname(OUTPUT_PATH);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Step 5: Write to file
      fs.writeFileSync(OUTPUT_PATH, data, 'utf8');

      // Step 6: Verify file exists and is readable
      if (!fs.existsSync(OUTPUT_PATH)) {
        console.error('❌ CRITICAL: Failed to write data file');
        console.error('::error::File write failed');
        process.exit(1);
      }

      console.log('✅ Resume data fetched successfully from gist');
      console.log(`   Saved to: ${OUTPUT_PATH}`);
      console.log(`   Size: ${(data.length / 1024).toFixed(1)} KB`);
    } catch (error) {
      console.error('❌ CRITICAL: Invalid JSON from gist');
      console.error('::error::JSON parse error');
      console.error(`Error: ${error.message}`);

      if (IS_PRODUCTION) {
        console.error('');
        console.error('Production build cannot proceed with malformed JSON.');
      }

      process.exit(1);
    }
  });
}).on('error', (error) => {
  console.error('❌ CRITICAL: Error fetching gist');
  console.error('::error::Network error');
  console.error(`Error: ${error.message}`);

  if (IS_PRODUCTION) {
    console.error('');
    console.error('Production build cannot proceed without gist data.');
    console.error('Check network connectivity and RESUME_DATA_GIST_URL.');
  }

  process.exit(1);
});
