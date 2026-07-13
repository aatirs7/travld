import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Shared workspace packages ship as TypeScript source; Next must transpile them.
  transpilePackages: ["@travld/core", "@travld/db", "@travld/ui"],
};

export default nextConfig;
