import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Disable ESLint rules that conflict with Prettier. Must be last.
  prettier,
  globalIgnores([
    "node_modules/**",
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "next-env.d.ts",
    // Coverage reports
    "coverage/**",
    "target/**",
    // Generated types
    "lib/types/generated-*.ts",
    // WASM outputs
    "public/wasm/**",
  ]),
]);

export default eslintConfig;
