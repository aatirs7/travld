import "./_env.js";
import { sql } from "drizzle-orm";
import { createPool } from "../src/pool.js";

async function main() {
  const { db, pool } = await createPool();
  try {
    console.log("── row counts by level ──");
    const counts = await db.execute(sql`
      SELECT level, count(*)::int AS n FROM places GROUP BY level
      ORDER BY array_position(ARRAY['continent','country','region','city']::text[], level::text)
    `);
    for (const r of counts.rows as any[]) console.log(`  ${r.level.padEnd(10)} ${r.n}`);

    console.log("\n── orphan cities (must be 0) ──");
    const orphans = await db.execute(
      sql`SELECT count(*)::int AS n FROM places WHERE level='city' AND parent_id IS NULL`,
    );
    console.log(`  ${(orphans.rows[0] as any).n}`);

    console.log("\n── parent-chain spot check (a city → region → country → continent) ──");
    const chain = await db.execute(sql`
      WITH RECURSIVE up AS (
        (SELECT id, name, level, parent_id, 0 AS depth
        FROM places WHERE level='city' AND population IS NOT NULL
        ORDER BY population DESC LIMIT 1)
        UNION ALL
        SELECT p.id, p.name, p.level, p.parent_id, up.depth+1
        FROM places p JOIN up ON p.id = up.parent_id
      )
      SELECT level, name FROM up ORDER BY depth
    `);
    for (const r of chain.rows as any[]) console.log(`  ${r.level.padEnd(10)} ${r.name}`);

    console.log("\n── search_vector / GIN full-text search (query: 'karachi') ──");
    const search = await db.execute(sql`
      SELECT name, level FROM places
      WHERE search_vector @@ to_tsquery('simple', 'karachi')
      LIMIT 3
    `);
    for (const r of search.rows as any[]) console.log(`  ${r.level.padEnd(10)} ${r.name}`);

    console.log("\n── dev-user derived stats (userPlaceStats cache) ──");
    const stats = await db.execute(sql`
      SELECT p.level, count(*)::int AS n
      FROM user_place_stats s JOIN places p ON p.id = s.place_id
      WHERE s.user_id = 'dev-user'
      GROUP BY p.level
      ORDER BY array_position(ARRAY['continent','country','region','city']::text[], p.level::text)
    `);
    for (const r of stats.rows as any[]) console.log(`  ${r.level.padEnd(10)} ${r.n}`);

    console.log("\n✓ verify complete");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
