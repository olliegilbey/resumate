import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import functional from "eslint-plugin-functional";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Immutable-first patterns: warn during MVP, don't block velocity.
  // NOTE: functional/immutable-data requires typed linting (parserOptions.project)
  // which is a bigger follow-up. Enable only the untyped rule for now.
  {
    plugins: { functional },
    rules: {
      "functional/no-let": "warn",
    },
  },
  // Global hardening. Per-file overrides below relax where needed.
  {
    rules: {
      "no-console": ["error", { allow: ["warn", "error"] }],
      // TODO(guardrails): tighten to 250 once ResumeDownload.tsx and the large
      // route handlers are split into focused modules.
      "max-lines": ["error", { max: 500, skipBlankLines: true, skipComments: true }],
    },
  },
  // Test files: allow any length; ban committed .only.
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/__tests__/**/*.ts", "**/__tests__/**/*.tsx"],
    rules: {
      "max-lines": "off",
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.object.name='it'][callee.property.name='only']",
          message: "Remove .only before committing",
        },
        {
          selector: "CallExpression[callee.object.name='describe'][callee.property.name='only']",
          message: "Remove .only before committing",
        },
        {
          selector: "CallExpression[callee.object.name='test'][callee.property.name='only']",
          message: "Remove .only before committing",
        },
      ],
    },
  },
  // Scripts: logging is the job, don't ban console.
  {
    files: ["scripts/**/*.{ts,tsx,js,mjs,cjs}"],
    rules: { "no-console": "off" },
  },
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
