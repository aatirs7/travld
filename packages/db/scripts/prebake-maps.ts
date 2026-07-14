import "./_env";
import { geoMercator, geoPath } from "d3-geo";
import { geoRobinson } from "d3-geo-projection";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { feature } from "topojson-client";
import { presimplify, simplify } from "topojson-simplify";
import { topology } from "topojson-server";

const here = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(here, "../data");
const REPO = resolve(here, "../../..");
const MOBILE_MAPS = resolve(REPO, "apps/mobile/assets/maps");
const WEB_ADMIN1 = resolve(REPO, "apps/web/public/maps/admin1");

// Admin-1 files small enough to ship in the app bundle; the rest load from CDN.
const BUNDLED_ADMIN1 = new Set(["US", "PK", "IN", "GB", "CA"]);

const WORLD_W = 1000;
const WORLD_H = 500;
const COUNTRY_SIZE = 800;

type GeoFeature = { type: "Feature"; properties: Record<string, any>; geometry: any };
type FC = { type: "FeatureCollection"; features: GeoFeature[] };

function prop(p: Record<string, any>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = p[k];
    if (v != null && v !== "" && v !== "-99") return String(v);
  }
  return null;
}

async function loadFC(file: string): Promise<FC> {
  return JSON.parse(await readFile(resolve(DATA, file), "utf8")) as FC;
}

/**
 * Visvalingam simplification: build a topology (shared arcs so borders stay
 * seam-free), drop points whose effective triangle area is below `minWeight`,
 * then reconstitute features. `retain` picks minWeight as a quantile of all
 * point weights so we keep the most significant vertices regardless of dataset.
 */
function simplifyFC(fc: FC, retain: number): FC {
  const topo = topology({ x: fc as any });
  const pre = presimplify(topo as any);
  // collect all point weights (z-coord added by presimplify) to derive a quantile
  const weights: number[] = [];
  for (const arc of (pre as any).arcs as number[][][]) {
    for (const p of arc) {
      const w = p[2];
      if (Number.isFinite(w) && w !== Infinity) weights.push(w as number);
    }
  }
  weights.sort((a, b) => a - b);
  const minWeight = weights.length
    ? weights[Math.floor((1 - retain) * (weights.length - 1))] ?? 0
    : 0;
  const simplified = simplify(pre as any, minWeight);
  return feature(simplified as any, (simplified as any).objects.x) as unknown as FC;
}

async function bakeWorld() {
  const raw = await loadFC("ne_admin0_countries.geojson");
  // Drop Antarctica — Been doesn't show it, and it letterboxes the projection
  // with an ugly grey blob. Removing it also lets the map fill the frame.
  raw.features = raw.features.filter(
    (f) =>
      prop(f.properties, "CONTINENT") !== "Antarctica" &&
      prop(f.properties, "ISO_A2_EH", "ISO_A2") !== "AQ",
  );
  // Higher retain = smoother coastlines (closer to Been). Still OTA-sized.
  const fc = simplifyFC(raw, 0.55);
  const projection = geoRobinson().fitSize([WORLD_W, WORLD_H], fc as any);
  const path = geoPath(projection);
  // round coordinates for a smaller payload
  if (typeof (path as any).digits === "function") (path as any).digits(1);

  const countries = fc.features
    .map((f) => {
      const iso = prop(f.properties, "ISO_A2_EH", "ISO_A2", "WB_A2");
      const name = prop(f.properties, "NAME_EN", "ADMIN", "NAME");
      const d = path(f as any);
      if (!iso || !d) return null;
      return { iso, name, d };
    })
    .filter((x): x is { iso: string; name: string | null; d: string } => x != null);

  await mkdir(MOBILE_MAPS, { recursive: true });
  const out = { projection: "robinson", width: WORLD_W, height: WORLD_H, countries };
  await writeFile(resolve(MOBILE_MAPS, "world-countries-simplified.json"), JSON.stringify(out));
  console.log(`✓ world: ${countries.length} countries → assets/maps/world-countries-simplified.json`);
}

async function bakeAdmin1() {
  const admin0 = await loadFC("ne_admin0_countries.geojson");
  const admin1 = simplifyFC(await loadFC("ne_admin1_states.geojson"), 0.5);

  // adm0_a3 → iso2 to key files by ISO2
  const iso2ByA3 = new Map<string, string>();
  for (const f of admin0.features) {
    const a3 = prop(f.properties, "ADM0_A3", "ISO_A3_EH", "ISO_A3");
    const iso2 = prop(f.properties, "ISO_A2_EH", "ISO_A2");
    if (a3 && iso2) iso2ByA3.set(a3, iso2);
  }

  const byCountry = new Map<string, GeoFeature[]>();
  for (const f of admin1.features) {
    const iso2 =
      prop(f.properties, "iso_a2") ??
      iso2ByA3.get(prop(f.properties, "adm0_a3", "sov_a3") ?? "") ??
      null;
    if (!iso2) continue;
    (byCountry.get(iso2) ?? byCountry.set(iso2, []).get(iso2)!).push(f);
  }

  await mkdir(WEB_ADMIN1, { recursive: true });
  await mkdir(resolve(MOBILE_MAPS, "admin1"), { recursive: true });

  let count = 0;
  for (const [iso2, features] of byCountry) {
    const fc: FC = { type: "FeatureCollection", features };
    const projection = geoMercator().fitSize([COUNTRY_SIZE, COUNTRY_SIZE], fc as any);
    const path = geoPath(projection);
    if (typeof (path as any).digits === "function") (path as any).digits(1);

    const regions = features
      .map((f) => {
        const code = prop(f.properties, "iso_3166_2", "code_hasc", "adm1_code");
        const name = prop(f.properties, "name_en", "name", "gn_name");
        const d = path(f as any);
        if (!d) return null;
        return { code, name, d };
      })
      .filter((x): x is { code: string | null; name: string | null; d: string } => x != null);

    if (!regions.length) continue;
    const out = { iso: iso2, projection: "mercator", width: COUNTRY_SIZE, height: COUNTRY_SIZE, regions };
    const json = JSON.stringify(out);
    await writeFile(resolve(WEB_ADMIN1, `${iso2}.json`), json);
    if (BUNDLED_ADMIN1.has(iso2)) {
      await writeFile(resolve(MOBILE_MAPS, "admin1", `${iso2}.json`), json);
    }
    count++;
  }
  console.log(`✓ admin-1: ${count} countries → apps/web/public/maps/admin1/ (${BUNDLED_ADMIN1.size} bundled)`);
}

async function main() {
  await bakeWorld();
  await bakeAdmin1();
  console.log("\n✓ prebake complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
