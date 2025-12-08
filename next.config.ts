import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack automatically respects .gitignore - no additional config needed
  // Rust build artifacts (target/) are excluded via .gitignore and tsconfig.json

  async rewrites() {
    return [
      {
        source: "/api/_lib/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/api/_lib/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
    ];
  },
  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
