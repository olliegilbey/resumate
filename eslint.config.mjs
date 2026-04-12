import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import functional from "eslint-plugin-functional";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Immutability enforcement: apply globally with tuned options.
  // - projectService: true enables typed linting (required for immutable-data).
  // - ignoreNonConstDeclarations: `let` is already caught by no-let; don't double-flag.
  // - ignoreClasses: class field assignments are idiomatic OOP, not drift.
  // - ignoreMapsAndSets: Map/Set have no immutable API; flagging .set/.add is noise.
  // Severity is `warn` today; promote to `error` once docs/IMMUTABILITY_GAPS.md is worked down.
  {
    plugins: { functional },
    languageOptions: {
      parserOptions: { projectService: true },
    },
    rules: {
      "functional/immutable-data": [
        "warn",
        {
          ignoreNonConstDeclarations: true,
          ignoreClasses: true,
          ignoreMapsAndSets: true,
        },
      ],
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
  // Disable ESLint rules that conflict with Prettier. Must be last of the rule blocks.
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
