import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and add your Neon connection string.",
    );
  }
  return url;
}

/**
 * Default client — HTTP driver. Lowest latency for single stateless queries in
 * serverless/edge request handlers (read paths, single-statement writes).
 */
export const db = drizzleHttp(neon(requireDatabaseUrl()), { schema });

export type Database = typeof db;
export { schema };
