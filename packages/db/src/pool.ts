import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleWs } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

/**
 * WebSocket pool driver. Use for anything needing a real interactive
 * transaction or high-volume batched writes:
 *   - the userPlaceStats cache upsert (read visits → recompute → upsert atomically)
 *   - the seed script (~59k inserts; HTTP would die of round trips)
 *
 * In a Node context (scripts, some serverless runtimes) neon needs a WebSocket
 * constructor. It is loaded lazily so edge bundles that only import `./client`
 * never pull in `ws`.
 */
export async function createPool() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and add your Neon connection string.",
    );
  }
  // Always use the `ws` package under Node. Node 22 ships a native global
  // WebSocket, but Neon's driver needs `ws` specifically — relying on the
  // native one fails the connection with an opaque ErrorEvent.
  if (!neonConfig.webSocketConstructor) {
    const ws = (await import("ws")).default;
    neonConfig.webSocketConstructor = ws as unknown as typeof WebSocket;
  }
  const pool = new Pool({ connectionString: url });
  const db = drizzleWs(pool, { schema });
  return { db, pool };
}

export { schema };
