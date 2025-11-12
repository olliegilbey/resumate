/**
 * Validate resume-data.json against JSON Schema
 *
 * Uses ajv to validate the compendium JSON against the schema.
 * Run with: just data-validate <path-to-json>
 */

import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Get JSON file path from command line
const jsonPath = process.argv[2]
if (!jsonPath) {
  console.error('❌ Usage: just data-validate <path-to-json>')
  process.exit(1)
}

// Read schema and data
const schemaPath = path.join(__dirname, '..', 'schemas', 'resume.schema.json')
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'))
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))

// Configure ajv
const ajv = new Ajv({
  allErrors: true,
  verbose: true,
  strict: false, // Allows schemars-specific keywords
})
addFormats(ajv)

// Validate
const validate = ajv.compile(schema)
const valid = validate(data)

if (valid) {
  console.log(`✅ ${path.basename(jsonPath)} is valid`)
  process.exit(0)
} else {
  console.error(`\n❌ ${path.basename(jsonPath)} validation failed:\n`)

  // Pretty print errors
  validate.errors?.forEach((error, index) => {
    console.error(`  ${index + 1}. ${error.instancePath || '(root)'}`)
    console.error(`     ${error.message}`)
    if (error.params && Object.keys(error.params).length > 0) {
      console.error(`     Params:`, JSON.stringify(error.params, null, 2))
    }
    console.error()
  })

  process.exit(1)
}
