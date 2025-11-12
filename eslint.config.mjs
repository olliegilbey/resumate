import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'

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
    'doc-gen/crates/public/wasm/**',
  ]),
])

export default eslintConfig
