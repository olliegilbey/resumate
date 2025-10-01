#!/usr/bin/env node

/**
 * View GitHub Gist in terminal
 *
 * Extracts gist ID from RESUME_DATA_GIST_URL and displays gist content
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

const result = spawnSync('gh', ['gist', 'view', gistId], {
  stdio: 'inherit'
});

if (result.status !== 0) {
  console.error('❌ Failed to view gist');
  process.exit(1);
}
