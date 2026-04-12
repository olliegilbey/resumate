// Ambient module declaration for the resume data JSON import.
//
// Without this, `import data from "@/data/resume-data.json"` gets a type
// inferred from whatever literal JSON happens to be on disk at compile
// time. That diverges between local dev (post-`just data-pull`) and
// Vercel builds (post-gist-fetch), and silently bypasses the Rust →
// schema → TS type pipeline.
//
// Anchoring every consumer to `ResumeData` keeps the type system unified:
// schema-optional fields stay `T | undefined` everywhere, regardless of
// which keys the current JSON snapshot includes.

declare module "@/data/resume-data.json" {
  import type { ResumeData } from "@/types/resume";
  const data: ResumeData;
  export default data;
}
