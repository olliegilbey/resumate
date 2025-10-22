/**
 * Clean template to match Rust serialization behavior
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatePath = path.join(__dirname, '..', 'data', 'resume-data-template.json');
const data = JSON.parse(fs.readFileSync(templatePath, 'utf-8'));

// Recursively remove null values
function removeNulls(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(removeNulls);
  } else if (obj !== null && typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== null) {
        result[key] = removeNulls(value);
      }
    }
    return result;
  }
  return obj;
}

// Fix tagWeights to ensure integer 1 becomes float 1.0
function fixTagWeights(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(fixTagWeights);
  } else if (obj !== null && typeof obj === 'object') {
    if (obj.tagWeights) {
      const fixed: any = {};
      for (const [key, value] of Object.entries(obj.tagWeights)) {
        fixed[key] = value === 1 ? 1.0 : value;
      }
      obj.tagWeights = fixed;
    }
    for (const key of Object.keys(obj)) {
      obj[key] = fixTagWeights(obj[key]);
    }
  }
  return obj;
}

const cleaned = removeNulls(data);
const fixed = fixTagWeights(cleaned);

fs.writeFileSync(templatePath, JSON.stringify(fixed, null, 2) + '\n');

console.log('✅ Template cleaned');
console.log('  - Removed null values');
console.log('  - Fixed tagWeight float formatting');
