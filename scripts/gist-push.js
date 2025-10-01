#!/usr/bin/env node

/**
 * Push local resume data to GitHub Gist
 *
 * Extracts gist ID from RESUME_DATA_GIST_URL and pushes data/resume-data.json
 */

const { spawnSync } = require('child_process');

// Load .env.local if it exists
try {
  require('dotenv').config({ path: '.env.local' });
} catch (error) {
  // dotenv not available
}

const GIST_URL = process.env.RESUME_DATA_GIST_URL;

if (!GIST_URL) {
  console.error('❌ RESUME_DATA_GIST_URL not set in .env.local');
  process.exit(1);
}

// Extract gist ID from URL
// Format: https://gist.githubusercontent.com/[user]/[gist-id]/raw/[commit-hash]/filename
const match = GIST_URL.match(/gist\.githubusercontent\.com\/[^\/]+\/([a-f0-9]+)/);

if (!match) {
  console.error('❌ Could not extract gist ID from RESUME_DATA_GIST_URL');
  console.error('   Expected format: https://gist.githubusercontent.com/[user]/[hash]/raw/...');
  process.exit(1);
}

const gistId = match[1];

console.log(`📤 Pushing data/resume-data.json to gist ${gistId}...`);

const result = spawnSync('gh', ['gist', 'edit', gistId, 'data/resume-data.json', '--filename', 'resume-data.json'], {
  stdio: 'inherit'
});

if (result.status === 0) {
  console.log('✅ Successfully pushed to gist');
} else {
  console.error('❌ Failed to push to gist');
  process.exit(1);
}
