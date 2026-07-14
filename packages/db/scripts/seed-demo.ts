import "./_env";
import { sql } from "drizzle-orm";
import { createPool } from "../src/pool";
import { recomputeUserPlaceStats } from "../src/stats";

// Demo users so social features (feed, compare, leaderboard) have data before
// auth exists. dev-user follows all of them.
const DEMO = [
  { id: "demo-farrukh", handle: "farrukh", name: "Farrukh", countries: ["JP", "KR", "TH", "VN", "SG", "PK"] },
  { id: "demo-sara", handle: "sara", name: "Sara", countries: ["FR", "IT", "ES", "PT", "DE", "GR", "US"] },
  { id: "demo-omar", handle: "omar", name: "Omar", countries: ["AE", "EG", "TR", "MA", "SA", "PK", "GB"] },
];

async function main() {
  const { db, pool } = await createPool();
  try {
    for (const u of DEMO) {
      await db.execute(sql`
        INSERT INTO users (id, handle, display_name)
        VALUES (${u.id}, ${u.handle}, ${u.name})
        ON CONFLICT (id) DO NOTHING
      `);
      // idempotent: clear this demo user's visits before reinserting
      await db.execute(sql`DELETE FROM visits WHERE user_id = ${u.id}`);
      // one visit to the largest city of each country
      for (const cc of u.countries) {
        await db.execute(sql`
          INSERT INTO visits (user_id, place_id, purpose)
          SELECT ${u.id}, id, 'leisure' FROM places
          WHERE level = 'city' AND country_code = ${cc}
          ORDER BY population DESC NULLS LAST LIMIT 1
        `);
      }
      await recomputeUserPlaceStats(db, u.id);
      // dev-user follows each demo user
      await db.execute(sql`
        INSERT INTO follows (follower_id, following_id)
        VALUES ('dev-user', ${u.id})
        ON CONFLICT DO NOTHING
      `);
      console.log(`✓ ${u.handle}: ${u.countries.length} countries, dev-user follows`);
    }

    // demo pending tag: farrukh tags dev-user in one of farrukh's visits
    await db.execute(sql`
      INSERT INTO visit_tags (visit_id, tagged_user_id, status)
      SELECT v.id, 'dev-user', 'pending' FROM visits v
      WHERE v.user_id = 'demo-farrukh'
      ORDER BY v.id LIMIT 1
      ON CONFLICT DO NOTHING
    `);
    console.log("✓ demo pending tag: farrukh → dev-user");

    console.log("\n✓ demo seed complete");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
