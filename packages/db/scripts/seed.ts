import "./_env.js";
import { geoBounds, geoCentroid } from "d3-geo";
import { eq, sql } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPool } from "../src/pool.js";
import { places, users, visits, type NewPlace } from "../src/schema.js";
import { recomputeUserPlaceStats } from "../src/stats.js";

const here = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(here, "../data");

// ─── reference tables (embedded) ─────────────────────────────────────────────
const CONTINENTS: { slug: string; name: string; code: string }[] = [
  { slug: "continent-africa", name: "Africa", code: "AF" },
  { slug: "continent-asia", name: "Asia", code: "AS" },
  { slug: "continent-europe", name: "Europe", code: "EU" },
  { slug: "continent-north-america", name: "North America", code: "NA" },
  { slug: "continent-south-america", name: "South America", code: "SA" },
  { slug: "continent-oceania", name: "Oceania", code: "OC" },
  { slug: "continent-antarctica", name: "Antarctica", code: "AN" },
];

const CONTINENT_CODE_TO_SLUG: Record<string, string> = Object.fromEntries(
  CONTINENTS.map((c) => [c.code, c.slug]),
);

const NE_CONTINENT_TO_SLUG: Record<string, string> = {
  Africa: "continent-africa",
  Asia: "continent-asia",
  Europe: "continent-europe",
  "North America": "continent-north-america",
  "South America": "continent-south-america",
  Oceania: "continent-oceania",
  Antarctica: "continent-antarctica",
};

// 193 UN member states (ISO3). Observer states / territories are is_un_member:false.
// The default "out of 195" denominator (Been parity) is a core constant, not this flag.
const UN_MEMBERS_ISO3 = new Set(
  ("AFG ALB DZA AND AGO ATG ARG ARM AUS AUT AZE BHS BHR BGD BRB BLR BEL BLZ BEN BTN BOL BIH BWA BRA BRN BGR BFA BDI CPV KHM CMR CAN CAF TCD CHL CHN COL COM COG COD CRI CIV HRV CUB CYP CZE DNK DJI DMA DOM ECU EGY SLV GNQ ERI EST SWZ ETH FJI FIN FRA GAB GMB GEO DEU GHA GRC GRD GTM GIN GNB GUY HTI HND HUN ISL IND IDN IRN IRQ IRL ISR ITA JAM JPN JOR KAZ KEN KIR PRK KOR KWT KGZ LAO LVA LBN LSO LBR LBY LIE LTU LUX MDG MWI MYS MDV MLI MLT MHL MRT MUS MEX FSM MDA MCO MNG MNE MAR MOZ MMR NAM NRU NPL NLD NZL NIC NER NGA MKD NOR OMN PAK PLW PAN PNG PRY PER PHL POL PRT QAT ROU RUS RWA KNA LCA VCT WSM SMR STP SAU SEN SRB SYC SLE SGP SVK SVN SLB SOM ZAF SSD ESP LKA SDN SUR SWE CHE SYR TJK TZA THA TLS TGO TON TTO TUN TUR TKM TUV UGA UKR ARE GBR USA URY UZB VUT VEN VNM YEM ZMB ZWE")
    .split(/\s+/),
);

const DISPLAY_TYPE_BY_ISO2: Record<string, string> = {
  US: "State", AU: "State", IN: "State", BR: "State", MX: "State",
  DE: "State", MY: "State", NG: "State", SS: "State", VE: "State",
  CA: "Province", CN: "Province", PK: "Province", ZA: "Province",
  ID: "Province", AR: "Province", NL: "Province",
  JP: "Prefecture", AE: "Emirate", CH: "Canton",
  GB: "Country", FR: "Region", IT: "Region", ES: "Region",
};

// ─── parsing helpers ─────────────────────────────────────────────────────────
type GeoFeature = {
  type: "Feature";
  properties: Record<string, any>;
  geometry: any;
};

function ne(prop: Record<string, any>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = prop[k];
    if (v != null && v !== "" && v !== "-99") return String(v);
  }
  return null;
}

function bboxOf(feature: GeoFeature): [number, number, number, number] | null {
  try {
    const [[minLng, minLat], [maxLng, maxLat]] = geoBounds(feature as any);
    if ([minLng, minLat, maxLng, maxLat].some((n) => !Number.isFinite(n))) return null;
    return [minLng, minLat, maxLng, maxLat];
  } catch {
    return null;
  }
}

function centroidOf(feature: GeoFeature): { lat: number; lng: number } | null {
  try {
    const [lng, lat] = geoCentroid(feature as any);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

async function loadJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(resolve(DATA, file), "utf8")) as T;
}

async function loadTsv(file: string): Promise<string[][]> {
  const text = await readFile(resolve(DATA, file), "utf8");
  return text
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split("\t"));
}

// ─── batched upsert ──────────────────────────────────────────────────────────
const CHUNK = 1000;

async function upsertPlaces(
  db: Awaited<ReturnType<typeof createPool>>["db"],
  rows: NewPlace[],
): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    await db.insert(places).values(chunk).onConflictDoNothing({ target: places.slug });
  }
}

async function idMapByLevel(
  db: Awaited<ReturnType<typeof createPool>>["db"],
  level: "continent" | "country" | "region",
): Promise<Map<string, number>> {
  const rows = await db
    .select({ id: places.id, slug: places.slug })
    .from(places)
    .where(eq(places.level, level));
  return new Map(rows.map((r) => [r.slug, r.id]));
}

// ─── main ──────────────────────────────────────────────────────────────────
async function main() {
  const { db, pool } = await createPool();
  try {
    console.log("→ parsing source files…");
    const admin0 = await loadJson<{ features: GeoFeature[] }>("ne_admin0_countries.geojson");
    const admin1Geo = await loadJson<{ features: GeoFeature[] }>("ne_admin1_states.geojson");
    const countryInfo = await loadTsv("countryInfo.txt");
    const admin1Codes = await loadTsv("admin1CodesASCII.txt");
    const cityRows = await loadTsv("cities5000.txt");

    // ── continents ──
    console.log("→ continents");
    await upsertPlaces(
      db,
      CONTINENTS.map((c) => ({ level: "continent" as const, name: c.name, slug: c.slug })),
    );
    const continentIds = await idMapByLevel(db, "continent");

    // ── countries: NE (geometry+attrs) then backfill from GeoNames countryInfo ──
    console.log("→ countries");
    const countryByIso2 = new Map<string, NewPlace>();
    // continent fallback per ISO2 from GeoNames
    const continentByIso2 = new Map<string, string>();
    for (const cols of countryInfo) {
      const iso2 = cols[0];
      const cont = cols[8];
      if (iso2 && cont) continentByIso2.set(iso2, cont);
    }

    for (const f of admin0.features) {
      const p = f.properties;
      const iso2 = ne(p, "ISO_A2_EH", "ISO_A2", "WB_A2");
      const iso3 = ne(p, "ISO_A3_EH", "ISO_A3", "ADM0_A3", "WB_A3");
      if (!iso2) continue;
      const name = ne(p, "NAME_EN", "ADMIN", "NAME_LONG", "NAME") ?? iso2;
      const contSlug =
        NE_CONTINENT_TO_SLUG[String(p.CONTINENT)] ??
        CONTINENT_CODE_TO_SLUG[continentByIso2.get(iso2) ?? ""] ??
        null;
      const c = centroidOf(f);
      countryByIso2.set(iso2, {
        level: "country",
        name,
        iso2,
        iso3: iso3 ?? undefined,
        parentId: contSlug ? continentIds.get(contSlug) : undefined,
        isUnMember: iso3 ? UN_MEMBERS_ISO3.has(iso3) : false,
        population: Number.isFinite(Number(p.POP_EST)) ? Math.trunc(Number(p.POP_EST)) : undefined,
        lat: c?.lat,
        lng: c?.lng,
        bbox: bboxOf(f) ?? undefined,
        slug: `country-${iso2.toLowerCase()}`,
      });
    }

    // backfill any GeoNames country not present from NE (no geometry)
    for (const cols of countryInfo) {
      const iso2 = cols[0];
      const iso3 = cols[1];
      const cName = cols[4];
      const contCode = cols[8];
      if (!iso2 || countryByIso2.has(iso2)) continue;
      const contSlug = CONTINENT_CODE_TO_SLUG[contCode ?? ""] ?? null;
      countryByIso2.set(iso2, {
        level: "country",
        name: cName || iso2,
        iso2,
        iso3: iso3 || undefined,
        parentId: contSlug ? continentIds.get(contSlug) : undefined,
        isUnMember: iso3 ? UN_MEMBERS_ISO3.has(iso3) : false,
        slug: `country-${iso2.toLowerCase()}`,
      });
    }

    await upsertPlaces(db, [...countryByIso2.values()]);
    const countryIds = await idMapByLevel(db, "country");
    const countryIdByIso2 = new Map<string, number>();
    for (const iso2 of countryByIso2.keys()) {
      const id = countryIds.get(`country-${iso2.toLowerCase()}`);
      if (id != null) countryIdByIso2.set(iso2, id);
    }
    console.log(`  ${countryByIso2.size} countries`);

    // ── regions: GeoNames admin1CodesASCII is canonical ──
    console.log("→ regions (GeoNames canonical list, NE geometry attached where codes match)");
    // NE admin-1 geometry indexed by "CC.admin1" derived from iso_3166_2 ("US-VA" → "US.VA")
    const neRegionByKey = new Map<string, GeoFeature>();
    for (const f of admin1Geo.features) {
      const code = ne(f.properties, "iso_3166_2", "code_hasc");
      if (!code) continue;
      const key = code.replace("-", ".");
      if (!neRegionByKey.has(key)) neRegionByKey.set(key, f);
    }

    const regionRows: NewPlace[] = [];
    for (const cols of admin1Codes) {
      const key = cols[0]; // "CC.admin1"
      const name = cols[1];
      if (!key || !name) continue;
      const [cc, admin1] = key.split(".");
      if (!cc || !admin1) continue;
      const parentId = countryIdByIso2.get(cc);
      if (parentId == null) continue; // country unknown → skip region (cities fall back to country)
      const geo = neRegionByKey.get(key);
      const c = geo ? centroidOf(geo) : null;
      regionRows.push({
        level: "region",
        name,
        parentId,
        countryCode: cc,
        admin1Code: admin1,
        displayType: DISPLAY_TYPE_BY_ISO2[cc] ?? "Region",
        lat: c?.lat,
        lng: c?.lng,
        bbox: geo ? bboxOf(geo) ?? undefined : undefined,
        slug: `region-${cc.toLowerCase()}-${admin1.toLowerCase()}`,
      });
    }
    await upsertPlaces(db, regionRows);
    const regionIds = await idMapByLevel(db, "region");
    console.log(`  ${regionRows.length} regions`);

    // ── cities: GeoNames cities5000, parent = region by (CC, admin1), else country ──
    console.log("→ cities");
    const cityPlaces: NewPlace[] = [];
    let regionParent = 0;
    let countryFallback = 0;
    for (const cols of cityRows) {
      const geonameid = cols[0];
      const name = cols[1];
      const lat = Number(cols[4]);
      const lng = Number(cols[5]);
      const cc = cols[8];
      const admin1 = cols[10];
      const population = Number(cols[14]);
      if (!geonameid || !name || !cc) continue;

      let parentId: number | undefined;
      if (admin1) {
        parentId = regionIds.get(`region-${cc.toLowerCase()}-${admin1.toLowerCase()}`);
        if (parentId != null) regionParent++;
      }
      if (parentId == null) {
        parentId = countryIdByIso2.get(cc);
        if (parentId != null) countryFallback++;
      }
      if (parentId == null) continue; // no country either → skip (asserted below)

      cityPlaces.push({
        level: "city",
        name,
        parentId,
        countryCode: cc,
        admin1Code: admin1 || undefined,
        lat: Number.isFinite(lat) ? lat : undefined,
        lng: Number.isFinite(lng) ? lng : undefined,
        population: Number.isFinite(population) ? Math.trunc(population) : undefined,
        slug: `city-${geonameid}`,
      });
    }
    await upsertPlaces(db, cityPlaces);
    console.log(
      `  ${cityPlaces.length} cities (${regionParent} → region, ${countryFallback} → country fallback)`,
    );

    // ── hard assertions (per plan correction) ──
    const orphanRes = await db.execute(
      sql`SELECT count(*)::int AS count FROM places WHERE level = 'city' AND parent_id IS NULL`,
    );
    const orphanCities = Number((orphanRes.rows?.[0] as any)?.count ?? 0);
    if (orphanCities > 0) {
      throw new Error(`ASSERTION FAILED: ${orphanCities} cities have a null parentId.`);
    }
    // A broken NE↔GeoNames join would dump most cities into the country fallback.
    if (countryFallback > cityPlaces.length * 0.15) {
      throw new Error(
        `ASSERTION FAILED: ${countryFallback}/${cityPlaces.length} cities fell back to country parent — region join likely broken.`,
      );
    }

    // ── dev user + sample visits (proves the derive-don't-store pipeline) ──
    console.log("→ dev user + sample visits");
    // Pick the largest city in each of a few countries — robust to any geonameid.
    async function topCity(cc: string): Promise<number | undefined> {
      const rows = await db.execute(sql`
        SELECT id FROM places
        WHERE level = 'city' AND country_code = ${cc}
        ORDER BY population DESC NULLS LAST
        LIMIT 1
      `);
      const id = (rows.rows?.[0] as any)?.id;
      return id != null ? Number(id) : undefined;
    }
    const sampleCityIds = (
      await Promise.all(["PK", "JP", "US", "FR"].map(topCity))
    ).filter((id): id is number => id != null);

    await db
      .insert(users)
      .values({
        id: "dev-user",
        handle: "dev",
        displayName: "Dev User",
        homePlaceId: sampleCityIds[0], // largest PK city as "home"
      })
      .onConflictDoNothing({ target: users.id });

    // seed a visit per sample country if the dev user has none yet
    const existing = await db
      .select({ id: visits.id })
      .from(visits)
      .where(eq(visits.userId, "dev-user"))
      .limit(1);
    if (existing.length === 0 && sampleCityIds.length) {
      await db.insert(visits).values(
        sampleCityIds.map((placeId) => ({
          userId: "dev-user",
          placeId,
          purpose: "leisure" as const,
        })),
      );
      console.log(`  ${sampleCityIds.length} sample visits`);
    }

    // rebuild the derived stats cache for the dev user (proves the upsert path)
    await recomputeUserPlaceStats(db, "dev-user");

    console.log("\n✓ seed complete");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
