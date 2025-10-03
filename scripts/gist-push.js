#!/usr/bin/env node

/**
 * Push local resume data to GitHub Gist
 *
 * Extracts gist ID from RESUME_DATA_GIST_URL and pushes data/resume-data.json
 *
 * Usage:
 *   npm run data:push           # Interactive (warns if gist is newer)
 *   npm run data:push -- --force # Skip prompts (for automation)
 */

const { spawnSync, execSync } = require('child_process');
const fs = require('fs');
const https = require('https');
const readline = require('readline');

// Load .env.local if it exists
try {
  require('dotenv').config({ path: '.env.local' });
} catch (error) {
  // dotenv not available
}

const GIST_URL = process.env.RESUME_DATA_GIST_URL;
const FORCE_MODE = process.argv.includes('--force');
const LOCAL_FILE = 'data/resume-data.json';

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

/**
 * Fetch current gist content
 */
function fetchGistContent() {
  return new Promise((resolve, reject) => {
    https.get(GIST_URL, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Main push logic
 */
async function pushToGist() {
  // Validate local file exists
  if (!fs.existsSync(LOCAL_FILE)) {
    console.error(`❌ Local file not found: ${LOCAL_FILE}`);
    process.exit(1);
  }

  // Read local content
  const localContent = fs.readFileSync(LOCAL_FILE, 'utf8');

  // Validate local JSON
  try {
    JSON.parse(localContent);
  } catch (error) {
    console.error('❌ Invalid JSON in local file:', error.message);
    process.exit(1);
  }

  // Check if gist differs from local (interactive mode only)
  if (!FORCE_MODE) {
    try {
      const gistContent = await fetchGistContent();

      if (gistContent !== localContent) {
        console.warn('\n⚠️  Warning: Gist content differs from local file!');
        console.warn('   This will OVERWRITE the gist with your local changes.');

        const confirmed = await promptUser('\nContinue? (y/N): ');

        if (!confirmed) {
          console.log('❌ Aborted. Gist unchanged.');
          console.log('💡 Tip: Run "npm run data:pull" to sync gist → local first.');
          process.exit(0);
        }
      }
    } catch (error) {
      console.warn(`⚠️  Could not fetch gist for comparison: ${error.message}`);
      console.warn('   Proceeding with push...');
    }
  }

  console.log(`📤 Pushing ${LOCAL_FILE} to gist ${gistId}...`);

  const result = spawnSync('gh', ['gist', 'edit', gistId, LOCAL_FILE, '--filename', 'resume-data.json'], {
    stdio: 'inherit'
  });

  if (result.status === 0) {
    console.log('✅ Successfully pushed to gist');
  } else {
    console.error('❌ Failed to push to gist');
    console.error('💡 Tip: Make sure GitHub CLI is installed and authenticated (gh auth login)');
    process.exit(1);
  }
}

pushToGist();
