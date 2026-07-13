import { sql } from "drizzle-orm";
import type { createPool } from "./pool";

type WsDatabase = Awaited<ReturnType<typeof createPool>>["db"];

/**
 * Rebuild the userPlaceStats cache for one user from their visit log, atomically.
 *
 * This is the "derive, never store" rule made concrete: visited state is a
 * projection over `visits`. A recursive CTE expands each visit to the visited
 * place AND all its ancestors (city → region → country → continent), so a
 * country's visitCount reflects every visit anywhere inside it.
 *
 * Called on every visit write. Full per-user recompute inside a transaction —
 * correct and cheap at a single user's visit volume; no cron.
 */
export async function recomputeUserPlaceStats(
  db: WsDatabase,
  userId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`DELETE FROM user_place_stats WHERE user_id = ${userId}`);
    await tx.execute(sql`
      WITH RECURSIVE visit_places AS (
        SELECT v.place_id AS place_id, p.parent_id AS parent_id,
               COALESCE(v.arrived_at, v.created_at) AS ts
        FROM visits v
        JOIN places p ON p.id = v.place_id
        WHERE v.user_id = ${userId}
        UNION ALL
        SELECT p.id AS place_id, p.parent_id AS parent_id, vp.ts AS ts
        FROM visit_places vp
        JOIN places p ON p.id = vp.parent_id
      )
      INSERT INTO user_place_stats (user_id, place_id, visit_count, first_visit_at, last_visit_at)
      SELECT ${userId}, place_id, COUNT(*)::int, MIN(ts), MAX(ts)
      FROM visit_places
      GROUP BY place_id
    `);
  });
}
