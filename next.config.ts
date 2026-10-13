import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for Azure App Service or a container
  // (docs/DEPLOYMENT.md). Netlify packages Next.js its own way, so leave it
  // off there (Netlify sets NETLIFY=true during builds).
  output: process.env.NETLIFY ? undefined : "standalone",
  poweredByHeader: false,
};

export default nextConfig;
