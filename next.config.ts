import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page in this app is per-user and session-dependent, so there is
  // nothing to cache ahead of time. Next 16's cacheComponents/partialPrefetching
  // are left off: they would forbid route-segment config and add Suspense
  // requirements for no benefit here.
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
