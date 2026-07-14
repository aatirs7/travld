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
 *
 * Instantiated LAZILY via a proxy: importing this module must not require
 * DATABASE_URL (otherwise `next build` collecting route metadata throws). The
 * real client is created on first property access, i.e. at request time.
 */
type HttpDb = ReturnType<typeof drizzleHttp<typeof schema>>;

let cached: HttpDb | null = null;
function getDb(): HttpDb {
  if (!cached) cached = drizzleHttp(neon(requireDatabaseUrl()), { schema });
  return cached;
}

export const db = new Proxy({} as HttpDb, {
  get(_target, prop, receiver) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
});

export type Database = HttpDb;
export { schema };
