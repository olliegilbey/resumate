// Conventional Commits, restricted to the types we actually use.
// `build` is included (beyond Nalu's set) because WASM/Rust/schema build
// changes legitimately need their own type separate from `chore`.
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "chore", "docs", "refactor", "test", "perf", "style", "ci", "build"],
    ],
  },
};
