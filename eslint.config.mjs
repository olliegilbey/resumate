import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import functional from 'eslint-plugin-functional'

const eslintConfig = defineConfig([
  ...nextVitals,
  globalIgnores([
    'node_modules/**',
    '.next/**',
    'out/**',
    'build/**',
    'dist/**',
    'next-env.d.ts',
    // Coverage reports
    'coverage/**',
    'target/**',
    // Generated types
    'lib/types/generated-*.ts',
    // WASM outputs
    'public/wasm/**',
  ]),
  // Immutability enforcement for agent-friendly code.
  // All warnings — signal for agents, not a gate that blocks work.
  // Promote to errors once gaps in docs/IMMUTABILITY_GAPS.md are addressed.
  {
    files: [
      'lib/**/*.ts',
      'lib/**/*.tsx',
      'app/api/**/*.ts',
      'app/api/**/*.tsx',
      '*.ts',
    ],
    ignores: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx'],
    plugins: { functional },
    languageOptions: {
      parserOptions: { projectService: true },
    },
    rules: {
      // Flags mutation of existing objects/arrays in place (requires typed linting).
      // ignoreNonConstDeclarations: let mutations are already caught by no-let.
      // ignoreClasses/ignoreMapsAndSets: reduce noise from idiomatic patterns.
      'functional/immutable-data': [
        'warn',
        {
          ignoreNonConstDeclarations: true,
          ignoreClasses: true,
          ignoreMapsAndSets: true,
        },
      ],
      // Prefer const over let declarations (no typed linting needed)
      'functional/no-let': 'warn',
    },
  },
])

export default eslintConfig
