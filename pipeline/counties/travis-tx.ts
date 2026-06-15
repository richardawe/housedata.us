import fs from "fs";
import readline from "readline";
import path from "path";
import type { CountyConfig, NormalizedParcel } from "../types";
import { normalizeAddress } from "../utils";

// ─────────────────────────────────────────────────────────────────────────────
// Travis County (Travis CAD) — 2025 certified roll
//
// Data source: https://traviscad.org/publicinformation/
//   → "2025 Certified Appraisal Export" (ZIP, ~487 MB)
// Extract the ZIP and set TRAVIS_ROLL_PATH to the directory containing
// PROP.TXT, PROP_ENT.TXT, and IMP_DET.TXT.
//
// All files are fixed-width (NOT CSV). Field positions are from:
//   TP_Legacy8.0.32-AppraisalExportLayout.xlsx (on the same download page)
//   Formula: Python [start:end] = XLSX_C - 1 : XLSX_D
//
// PROP.TXT      — one record per (property × owner); deduplicate on prop_id
// PROP_ENT.TXT  — one record per (property × taxing entity); use entity_cd "0000A"
//                 (TRAVIS CENTRAL APP DIST) for the authoritative values
// IMP_DET.TXT   — one record per improvement detail; use the first record per
//                 property for yr_built and living area
// ─────────────────────────────────────────────────────────────────────────────

// State codes for residential property (Texas Comptroller classification)
const RESIDENTIAL_CLASSES = new Set([
  "A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", // Single-family and variants
  "B1", "B2", "B3", "B4",                                 // Multifamily
]);

// Extract a trimmed string slice from a fixed-width record line
function fw(line: string, start: number, end: number): string {
  return line.substring(start, end).trim();
}

// Parse a zero-padded numeric field; returns null if zero or missing
function fwInt(line: string, start: number, end: number): number | null {
  const v = parseInt(line.substring(start, end).trim() || "0", 10);
  return isNaN(v) || v === 0 ? null : v;
}

// ─── PROP_ENT.TXT reader ─────────────────────────────────────────────────────
// Returns a Map from prop_id → { marketValue, assessedValue }
// Only records with entity_cd "0000A" (Travis Central Appraisal District)
//
// Key positions (XLSX_C - 1):
//   prop_id     XLSX  1-12  → [  0: 12]
//   entity_cd   empirical   → [ 50: 60]   "0000A     "  (XLSX says 54 but field is 3 chars shorter in file)
//   assessed_val XLSX 149-163 → [148:163]  taxable value after cap
//   market_value XLSX 389-403 → [388:403]  appraised/market value
async function loadPropEnt(
  rollDir: string
): Promise<Map<string, { marketValue: number | null; assessedValue: number | null }>> {
  const map = new Map<string, { marketValue: number | null; assessedValue: number | null }>();
  const filePath = path.join(rollDir, "PROP_ENT.TXT");
  if (!fs.existsSync(filePath)) {
    console.warn(`  [WARN] PROP_ENT.TXT not found at ${filePath} — values will be null`);
    return map;
  }

  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: "latin1" }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (line.length < 200) continue;
    const entityCd = fw(line, 50, 60);
    if (entityCd !== "0000A") continue;

    const propId = fw(line, 0, 12);
    if (map.has(propId)) continue; // keep first 0000A record

    map.set(propId, {
      marketValue: fwInt(line, 388, 403),
      assessedValue: fwInt(line, 148, 163),
    });
  }

  return map;
}

// ─── IMP_DET.TXT reader ──────────────────────────────────────────────────────
// Returns a Map from prop_id → { yrBuilt, sqft }
// Uses the FIRST detail record per property (primary improvement)
//
// Key positions (XLSX_C - 1):
//   prop_id          XLSX  1-12  → [  0: 12]
//   yr_built         XLSX 86-89  → [ 85: 89]   e.g. "1984"
//   imprv_det_area   XLSX 94-108 → [ 93:108]   living area (sq ft, 15 chars)
async function loadImpDet(
  rollDir: string
): Promise<Map<string, { yrBuilt: number | null; sqft: number | null }>> {
  const map = new Map<string, { yrBuilt: number | null; sqft: number | null }>();
  const filePath = path.join(rollDir, "IMP_DET.TXT");
  if (!fs.existsSync(filePath)) {
    console.warn(`  [WARN] IMP_DET.TXT not found at ${filePath} — yr_built/sqft will be null`);
    return map;
  }

  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: "latin1" }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (line.length < 100) continue;
    const propId = fw(line, 0, 12);
    if (map.has(propId)) continue; // keep first record per property

    map.set(propId, {
      yrBuilt: fwInt(line, 85, 89),
      sqft: fwInt(line, 93, 108),
    });
  }

  return map;
}

// ─── Main parcel loader ───────────────────────────────────────────────────────
// Streams PROP.TXT and joins against the pre-loaded PROP_ENT and IMP_DET maps.
//
// Key PROP.TXT positions (XLSX_C - 1):
//   prop_id           XLSX   1-12  → [   0:  12]
//   prop_type_cd      XLSX  13-17  → [  12:  17]  "R    " = real property
//   prop_val_yr       XLSX  18-22  → [  17:  22]
//   geo_id            XLSX 547-596 → [ 546: 596]  external account number (50 chars)
//   situs_num         XLSX 4460-4474 → [4459:4474] house number
//   situs_street_prefx XLSX 1040-1049 → [1039:1049] direction prefix
//   situs_street      XLSX 1050-1099 → [1049:1099] street name
//   situs_street_suffix XLSX 1100-1109 → [1099:1109] type (ST/BLVD/etc.)
//   situs_city        XLSX 1110-1139 → [1109:1139]
//   situs_zip         XLSX 1140-1149 → [1139:1149]
//   hood_cd           XLSX 1686-1695 → [1685:1695]
//   land_hstd_val     XLSX 1796-1810 → [1795:1810]
//   land_non_hstd_val XLSX 1811-1825 → [1810:1825]
//   imprv_hstd_val    XLSX 1826-1840 → [1825:1840]
//   imprv_non_hstd_val XLSX 1841-1855 → [1840:1855]
//   hs_exempt         XLSX 2609-2609 → [2608:2609] 'T'/'F'
//   ov65_exempt       XLSX 2610-2610 → [2609:2610]
//   dp_exempt         XLSX 2662-2662 → [2661:2662]
//   imprv_state_cd    XLSX 2732-2741 → [2731:2741] e.g. "A1"
async function loadParcelsFn(rollDir: string): Promise<NormalizedParcel[]> {
  console.log("  Loading PROP_ENT.TXT (values)…");
  const entMap = await loadPropEnt(rollDir);
  console.log(`  PROP_ENT.TXT: ${entMap.size.toLocaleString()} entity-0000A records`);

  console.log("  Loading IMP_DET.TXT (yr_built / sqft)…");
  const impMap = await loadImpDet(rollDir);
  console.log(`  IMP_DET.TXT: ${impMap.size.toLocaleString()} improvement records`);

  const propPath = path.join(rollDir, "PROP.TXT");
  if (!fs.existsSync(propPath)) {
    throw new Error(`PROP.TXT not found at ${propPath}`);
  }

  console.log("  Streaming PROP.TXT…");
  const parcels: NormalizedParcel[] = [];
  // Deduplicate on accountId: UDI properties have multiple prop_ids but the same geo_id
  const seenAccountIds = new Set<string>();

  const rl = readline.createInterface({
    input: fs.createReadStream(propPath, { encoding: "latin1" }),
    crlfDelay: Infinity,
  });

  let lineCount = 0;
  for await (const line of rl) {
    lineCount++;
    if (line.length < 1000) continue;

    const propId = fw(line, 0, 12);

    // Only real property
    const propTypeCd = fw(line, 12, 17);
    if (!propTypeCd.startsWith("R")) continue;

    // Only residential state classes
    const stateClass = fw(line, 2731, 2741);
    if (!RESIDENTIAL_CLASSES.has(stateClass)) continue;

    // Values from PROP_ENT.TXT
    const ent = entMap.get(propId);
    if (!ent || !ent.marketValue) continue;

    // geo_id (external account number, 50-char field, right-padded)
    // UDI properties: multiple owners share same geo_id — keep first only
    const geoId = fw(line, 546, 596) || propId;
    if (seenAccountIds.has(geoId)) continue;
    seenAccountIds.add(geoId);

    // Improvement data
    const imp = impMap.get(propId);

    // Build situs address: number + direction + street + suffix
    const situsNum = fw(line, 4459, 4474);
    const situsPfx = fw(line, 1039, 1049);
    const situsStreet = fw(line, 1049, 1099);
    const situsSuffix = fw(line, 1099, 1109);
    const rawAddress = [situsNum, situsPfx, situsStreet, situsSuffix]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ");
    if (!rawAddress) continue;

    // Land and improvement components
    const landHstd = fwInt(line, 1795, 1810) ?? 0;
    const landNonHstd = fwInt(line, 1810, 1825) ?? 0;
    const imprvHstd = fwInt(line, 1825, 1840) ?? 0;
    const imprvNonHstd = fwInt(line, 1840, 1855) ?? 0;

    // Exemptions (single-char flags)
    const exemptions: string[] = [];
    if (fw(line, 2608, 2609) === "T") exemptions.push("HS");
    if (fw(line, 2609, 2610) === "T") exemptions.push("OV65");
    if (fw(line, 2661, 2662) === "T") exemptions.push("DP");

    parcels.push({
      accountId: geoId,
      situsAddress: normalizeAddress(rawAddress),
      situsCity: fw(line, 1109, 1139) || null,
      situsZip: fw(line, 1139, 1149) || null,
      neighborhoodCode: fw(line, 1685, 1695) || null,
      stateClass,
      marketValue: ent.marketValue,
      assessedValue: ent.assessedValue,
      landValue: (landHstd + landNonHstd) || null,
      improvementValue: (imprvHstd + imprvNonHstd) || null,
      livingSqft: imp?.sqft ?? null,
      yearBuilt: imp?.yrBuilt ?? null,
      qualityClass: null,
      exemptions,
      lat: null,
      lng: null,
    });

    if (parcels.length % 10000 === 0) {
      process.stdout.write(`  ${parcels.length.toLocaleString()} residential parcels loaded\r`);
    }
  }

  console.log(`\n  PROP.TXT: ${lineCount.toLocaleString()} lines → ${parcels.length.toLocaleString()} residential parcels`);
  return parcels;
}

// ─────────────────────────────────────────────────────────────────────────────
// County configuration
// ─────────────────────────────────────────────────────────────────────────────

const rollDir = process.env.TRAVIS_ROLL_PATH ?? "";

const travisConfig: CountyConfig = {
  slug: "travis-tx",
  name: "Travis County",
  state: "TX",
  rollPath: rollDir, // not used for fixed-width loading, but required by interface
  protestDeadlineRule: "May 15 or 30 days after Notice of Appraised Value, whichever is later",
  arbFilingUrl: "https://traviscad.org/efile/",
  taxYear: 2025,

  // Combined property tax rate (per $100) — typical Austin ISD / City of Austin parcel.
  // Source: https://tax-office.traviscountytx.gov/ (2025 rates)
  jurisdictions: [
    { name: "Austin ISD",              rate: 0.9252 },
    { name: "Travis County",           rate: 0.3758 },
    { name: "City of Austin",          rate: 0.5740 },
    { name: "Austin Community College", rate: 0.1279 },
    { name: "Central Health",          rate: 0.1180 },
  ],

  loadParcels(): Promise<NormalizedParcel[]> {
    if (!rollDir) {
      throw new Error(
        "TRAVIS_ROLL_PATH is not set.\n" +
        "1. Download the ZIP from https://traviscad.org/publicinformation/\n" +
        "2. Extract it to a directory (e.g. /tmp/travis-roll/)\n" +
        "3. Set TRAVIS_ROLL_PATH=/tmp/travis-roll/ in .env.local"
      );
    }
    return loadParcelsFn(rollDir);
  },
};

export default travisConfig;
