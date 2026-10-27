import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // PGlite (local dev database) ships WASM; keep it out of the server bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Route handlers that read files from public/ at runtime need them traced into the function bundle.
  outputFileTracingIncludes: {
    "/api/fields": ["./public/data/districts.topo.json"],
    "/api/atlas/district-at": ["./public/data/districts.topo.json"],
    "/api/**": ["./db/migrations/**"],
  },
  async headers() {
    return [
      {
        source: "/data/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
    ];
  },
};

export default nextConfig;
