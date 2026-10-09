import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Posters and covers load straight from TMDb / Open Library (`unoptimized`),
  // so the image optimizer needs no remote allowlist.
  async redirects() {
    return [{ source: "/", destination: "/movies", permanent: false }];
  },
};

export default nextConfig;
