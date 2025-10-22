/**
 * Generate TypeScript types from JSON Schemas
 *
 * Reads schemas emitted from Rust and generates TypeScript types.
 * Run with: just types-ts
 *
 * Usage:
 *   tsx scripts/gen-ts-from-schemas.ts --input <schema-path> --output <output-path>
 */

import { compileFromFile } from 'json-schema-to-typescript'
import * as fs from 'fs'
import * as path from 'path'

async function generateTypes() {
  console.log('📝 Generating TypeScript types from JSON Schemas...\n')

  // Parse command-line arguments
  const args = process.argv.slice(2)
  const inputIndex = args.indexOf('--input')
  const outputIndex = args.indexOf('--output')

  const inputPath = inputIndex !== -1 ? args[inputIndex + 1] : 'types/generated/schema.json'
  const outputPath = outputIndex !== -1 ? args[outputIndex + 1] : 'lib/types/generated-resume.ts'

  const absoluteInputPath = path.join(process.cwd(), inputPath)
  const absoluteOutputPath = path.join(process.cwd(), outputPath)

  console.log(`  Input:  ${inputPath}`)
  console.log(`  Output: ${outputPath}\n`)

  // Ensure output directory exists
  const outputDir = path.dirname(absoluteOutputPath)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // Generate from schema
  const ts = await compileFromFile(absoluteInputPath, {
    bannerComment: `/**
 * Generated TypeScript types from Rust schemas
 * DO NOT EDIT MANUALLY - Generated via: just types-ts
 * Source: ${inputPath}
 */`,
    style: {
      semi: false,
      singleQuote: true,
    },
  })

  fs.writeFileSync(absoluteOutputPath, ts)
  console.log(`✅ Generated: ${outputPath}`)

  console.log('\n📝 Type generation complete!')
}

generateTypes().catch((error) => {
  console.error('❌ Type generation failed:', error)
  process.exit(1)
})
