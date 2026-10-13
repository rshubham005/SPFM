import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle in .next/standalone, for Azure App Service
  // or a container. See docs/DEPLOYMENT.md.
  output: "standalone",
  poweredByHeader: false,
};

export default nextConfig;
