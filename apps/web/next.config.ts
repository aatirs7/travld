import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// Single source of truth: load the monorepo root .env (DATABASE_URL, etc.).
const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../.env") });

const nextConfig: NextConfig = {
  // Shared workspace packages ship as TypeScript source; Next must transpile them.
  transpilePackages: ["@travld/core", "@travld/db", "@travld/ui"],
};

export default nextConfig;
