import fs from "fs";
import path from "path";
import * as csv from "csv-parse";
import type { CountyConfig, NormalizedParcel } from "../types";
import { normalizeAddress } from "../utils";

// Harris County Appraisal District (HCAD) — 2025 appraisal roll
//
// Data source: https://hcad.org/pdata/pdata-property-downloads.html
//   → "Real Property" section — download and extract both ZIPs into one directory:
//     Real_acct_owner.zip   → real_acct.txt
//     Real_building_land.zip → building_res.txt
//
// Set HARRIS_ROLL_PATH to the directory containing both extracted .txt files.
//
// Files are tab-delimited ASCII with a header row.
// Data codebook: https://hcad.org/assets/uploads/pdf/pdataCodebook.pdf
//
// ~1 million residential parcels (A1/A2/B1/B2 classes from ~1.96M total).

const RESIDENTIAL_CLASSES = new Set([
  "A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9",
  "B1", "B2", "B3", "B4",
]);

function parseNum(v: string | undefined): number | null {
  const n = parseFloat(v ?? "");
  return isFinite(n) && n > 0 ? n : null;
}

function parseYear(v: string | undefined): number | null {
  const n = parseInt(v ?? "", 10);
  return n > 1800 && n <= new Date().getFullYear() + 1 ? n : null;
}

// Load building_res.txt into a Map<acct, {sqft, yearBuilt}>.
// Takes the first record per account (primary improvement).
async function loadBuildings(
  rollDir: string
): Promise<Map<string, { sqft: number | null; yearBuilt: number | null }>> {
  const map = new Map<string, { sqft: number | null; yearBuilt: number | null }>();
  const filePath = path.join(rollDir, "building_res.txt");
  if (!fs.existsSync(filePath)) {
    console.warn(`  [WARN] building_res.txt not found — sqft/yearBuilt will be null`);
    return map;
  }

  await new Promise<void>((resolve, reject) => {
    const parser = csv.parse({ columns: true, delimiter: "\t", trim: true, skip_empty_lines: true });
    fs.createReadStream(filePath, { encoding: "latin1" }).pipe(parser);
    parser.on("readable", () => {
      let row: Record<string, string>;
      while ((row = parser.read()) !== null) {
        const acct = row.acct?.trim();
        if (!acct || map.has(acct)) continue; // keep first record per account
        map.set(acct, {
          sqft:      parseNum(row.heat_ar),
          yearBuilt: parseYear(row.date_erected),
        });
      }
    });
    parser.on("end", resolve);
    parser.on("error", reject);
  });

  return map;
}

async function loadParcelsFn(rollDir: string): Promise<NormalizedParcel[]> {
  console.log("  Loading building_res.txt (sqft / year built)…");
  const bldMap = await loadBuildings(rollDir);
  console.log(`  building_res.txt: ${bldMap.size.toLocaleString()} records`);

  const acctPath = path.join(rollDir, "real_acct.txt");
  if (!fs.existsSync(acctPath)) throw new Error(`real_acct.txt not found at ${acctPath}`);

  console.log("  Streaming real_acct.txt…");
  const parcels: NormalizedParcel[] = [];
  const seen = new Set<string>();

  await new Promise<void>((resolve, reject) => {
    const parser = csv.parse({ columns: true, delimiter: "\t", trim: true, skip_empty_lines: true });
    fs.createReadStream(acctPath, { encoding: "latin1" }).pipe(parser);

    parser.on("readable", () => {
      let row: Record<string, string>;
      while ((row = parser.read()) !== null) {
        const acct = row.acct?.trim();
        if (!acct || seen.has(acct)) continue;

        const stateClass = row.state_class?.trim();
        if (!RESIDENTIAL_CLASSES.has(stateClass)) continue;

        const marketValue = parseNum(row.tot_mkt_val);
        if (!marketValue) continue;

        // site_addr_2 = "HOUSTON TX" — strip trailing state code to get city
        const addr2 = (row.site_addr_2 ?? "").trim();
        const city  = addr2.replace(/\s+[A-Z]{2}$/, "").trim() || null;
        const zip   = (row.site_addr_3 ?? "").trim() || null;

        const situsAddress = normalizeAddress(row.site_addr_1 ?? "");
        if (!situsAddress) continue;

        seen.add(acct);
        const bld = bldMap.get(acct);

        parcels.push({
          accountId:        acct,
          situsAddress,
          situsCity:        city,
          situsZip:         zip,
          neighborhoodCode: row.Neighborhood_Code?.trim() || null,
          stateClass,
          marketValue,
          assessedValue:    parseNum(row.tot_appr_val),
          landValue:        parseNum(row.land_val),
          improvementValue: parseNum(row.bld_val),
          livingSqft:       bld?.sqft      ?? null,
          yearBuilt:        bld?.yearBuilt  ?? null,
          qualityClass:     null,
          exemptions:       [],  // full exemptions require jur_exempt_cd.txt join
          lat: null,
          lng: null,
        });

        if (parcels.length % 10000 === 0)
          process.stdout.write(`  ${parcels.length.toLocaleString()} residential parcels\r`);
      }
    });
    parser.on("end", resolve);
    parser.on("error", reject);
  });

  console.log(`\n  real_acct.txt: ${parcels.length.toLocaleString()} residential parcels`);
  return parcels;
}

const rollDir = process.env.HARRIS_ROLL_PATH ?? "";

const harrisConfig: CountyConfig = {
  slug: "harris-tx",
  name: "Harris County",
  state: "TX",
  rollPath: rollDir,
  protestDeadlineRule: "May 15 or 30 days after Notice of Appraised Value, whichever is later",
  arbFilingUrl: "https://hcad.org/appeals/online-appeals/",
  taxYear: 2025,

  // Typical Houston/Harris County rates (varies by MUD, city, ISD).
  // Source: 2025 certified rates — update per jurisdiction as needed.
  jurisdictions: [
    { name: "Harris County",              rate: 0.3788 },
    { name: "City of Houston",            rate: 0.5335 },
    { name: "Houston ISD",                rate: 1.0180 },
    { name: "Harris County Flood Control", rate: 0.0459 },
    { name: "Port of Houston",            rate: 0.0089 },
  ],

  loadParcels(): Promise<NormalizedParcel[]> {
    if (!rollDir)
      throw new Error(
        "HARRIS_ROLL_PATH is not set.\n" +
        "1. Download Real_acct_owner.zip and Real_building_land.zip from\n" +
        "   https://hcad.org/pdata/pdata-property-downloads.html\n" +
        "2. Extract both into one directory (e.g. /tmp/harris-roll/)\n" +
        "3. Set HARRIS_ROLL_PATH=/tmp/harris-roll/ in .env.local"
      );
    return loadParcelsFn(rollDir);
  },
};

export default harrisConfig;
