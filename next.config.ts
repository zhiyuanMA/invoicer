import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A self-contained server in .next/standalone, which is what the Docker image runs.
  output: "standalone",
  // The end-to-end tests build into their own folder so they never disturb a running dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  // Playwright launches a browser binary; keep it out of the bundle.
  serverExternalPackages: ["playwright"],
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
