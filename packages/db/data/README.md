# Seed source data

These files are **not committed** (see root `.gitignore`). Fetch them with:

```bash
pnpm --filter @travld/db download-data
```

| File | Source | License | Used for |
|---|---|---|---|
| `ne_admin0_countries.geojson` | [Natural Earth 50m admin-0](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_admin_0_countries.geojson) | Public domain | Country rows + world passport-map geometry |
| `ne_admin1_states.geojson` | [Natural Earth 10m admin-1](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_10m_admin_1_states_provinces.geojson) | Public domain | Region **geometry** (attached by `iso_3166_2`, centroid PIP fallback) + per-country admin-1 maps |
| `admin1CodesASCII.txt` | [GeoNames](https://download.geonames.org/export/dump/admin1CodesASCII.txt) | CC-BY 4.0 | **Canonical region list** — guarantees every city has a parent |
| `countryInfo.txt` | [GeoNames](https://download.geonames.org/export/dump/countryInfo.txt) | CC-BY 4.0 | ISO2/ISO3/continent cross-reference |
| `cities5000.txt` | [GeoNames cities5000.zip](https://download.geonames.org/export/dump/cities5000.zip) | CC-BY 4.0 | ~55k cities (pop ≥ 5,000) |

## Why GeoNames is canonical for regions

Natural Earth `iso_3166_2` and GeoNames admin1 codes do **not** share a code space
(GeoNames is ISO for some countries, FIPS for others). Joining cities to NE regions
naively silently orphans tens of thousands of cities. So: seed regions from GeoNames
`admin1CodesASCII.txt` (city → region join guaranteed by construction), then attach NE
geometry where it matches. The seed **hard-fails** if any city has a null `parentId`.

> **Attribution:** GeoNames data is CC-BY 4.0 — a "Data © GeoNames" line is owed in
> Settings → About (tracked for a later phase).
