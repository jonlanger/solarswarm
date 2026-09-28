import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Production builds for local checks go to their own dir (NEXT_DIST_DIR=.next-prod, see .claude/launch.json)
  // so `next build` never overwrites the running dev server's .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // pin the workspace root (a stray lockfile in the home directory otherwise confuses root inference)
  outputFileTracingRoot: process.cwd(),
  turbopack: { root: process.cwd() },
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    // Draco decoder + versioned models (?v=…) and renders are immutable between releases
    return [
      { source: "/draco/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      { source: "/models/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }] },
    ];
  },
};

export default nextConfig;
