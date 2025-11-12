import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack automatically respects .gitignore - no additional config needed
  // Rust build artifacts (target/) are excluded via .gitignore and tsconfig.json
};

export default nextConfig;
