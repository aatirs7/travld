import "./_env";
import AdmZip from "adm-zip";
import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(here, "../data");

const NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson";
const GEONAMES = "https://download.geonames.org/export/dump";

type Source = { url: string; out: string; unzipEntry?: string };

// Natural Earth = public domain. GeoNames = CC-BY 4.0 (attribution owed in Settings > About).
const SOURCES: Source[] = [
  { url: `${NE}/ne_50m_admin_0_countries.geojson`, out: "ne_admin0_countries.geojson" },
  { url: `${NE}/ne_10m_admin_1_states_provinces.geojson`, out: "ne_admin1_states.geojson" },
  { url: `${GEONAMES}/admin1CodesASCII.txt`, out: "admin1CodesASCII.txt" },
  { url: `${GEONAMES}/countryInfo.txt`, out: "countryInfo.txt" },
  { url: `${GEONAMES}/cities5000.zip`, out: "cities5000.txt", unzipEntry: "cities5000.txt" },
];

async function downloadTo(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
  }
  await mkdir(dirname(dest), { recursive: true });
  await pipeline(Readable.fromWeb(res.body as any), createWriteStream(dest));
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true });
  for (const src of SOURCES) {
    const dest = resolve(DATA_DIR, src.out);
    if (src.unzipEntry) {
      const zipPath = resolve(DATA_DIR, src.out.replace(/\.txt$/, ".zip"));
      console.log(`↓ ${src.url}`);
      await downloadTo(src.url, zipPath);
      const zip = new AdmZip(zipPath);
      const entry = zip.getEntry(src.unzipEntry);
      if (!entry) throw new Error(`Zip entry ${src.unzipEntry} not found in ${zipPath}`);
      zip.extractEntryTo(entry, DATA_DIR, false, true);
      await rm(zipPath);
      console.log(`  ✓ unzipped → ${src.out}`);
    } else {
      console.log(`↓ ${src.url}`);
      await downloadTo(src.url, dest);
      console.log(`  ✓ ${src.out}`);
    }
  }
  console.log(`\nAll source data downloaded to ${DATA_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
