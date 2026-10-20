import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Offline, navigations and Server Actions (swipes, saves, check-ins) wait
    // and retry when the connection returns instead of failing.
    useOffline: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Posters and covers load straight from TMDb / Open Library (`unoptimized`),
  // so the image optimizer needs no remote allowlist. "/" is the landing page
  // signed out; proxy.ts sends you on to /movies when you're signed in.
  async headers() {
    return [
      {
        // The service worker must never be cached, or an old one lingers after a deploy.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
