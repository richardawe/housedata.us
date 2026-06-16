import fs from "fs";
import path from "path";
import * as csv from "csv-parse";
import type { CountyConfig, NormalizedParcel } from "../types";
import { normalizeAddress } from "../utils";

// Dallas County Appraisal District (DCAD) — 2026 appraisal roll
//
// Data source: https://www.dallascad.org/dataproducts.aspx
//   → "Appraisal Data" → download the current year ZIP
//
// Extract the ZIP to a directory and set DALLAS_ROLL_PATH to that directory.
// The ZIP contains multiple CSV files + "TABLES AND FIELD NAMES.xlsx" (field dictionary).
//
// Required files (comma-delimited CSV, with header row):
//   ACCOUNT_APPRL_YEAR.CSV — market/appraised/land/improvement values + state class
//   ACCOUNT_INFO.CSV       — situs address, city, zip
//   RES_DETAIL.CSV         — living sqft, year built
//
// Join key: ACCOUNT_NUM  (17-digit identifier)
// ~675K residential parcels.

const RESIDENTIAL_CLASSES = new Set([
  "A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9",
  "B1", "B2", "B3", "B4",
]);

function parseNum(v: string | undefined): number | null {
  const n = parseFloat((v ?? "").replace(/,/g, ""));
  return isFinite(n) && n > 0 ? n : null;
}

function parseYear(v: string | undefined): number | null {
  const n = parseInt(v ?? "", 10);
  return n > 1800 && n <= new Date().getFullYear() + 1 ? n : null;
}

async function streamCsvMap<V>(
  filePath: string,
  handler: (row: Record<string, string>) => [string, V] | null
): Promise<Map<string, V>> {
  const map = new Map<string, V>();
  if (!fs.existsSync(filePath)) {
    console.warn(`  [WARN] ${path.basename(filePath)} not found`);
    return map;
  }
  await new Promise<void>((resolve, reject) => {
    const parser = csv.parse({ columns: true, trim: true, skip_empty_lines: true });
    fs.createReadStream(filePath, { encoding: "utf-8" }).pipe(parser);
    parser.on("readable", () => {
      let row: Record<string, string>;
      while ((row = parser.read()) !== null) {
        const entry = handler(row);
        if (entry) map.set(entry[0], entry[1]);
      }
    });
    parser.on("end", resolve);
    parser.on("error", reject);
  });
  return map;
}

async function loadParcelsFn(rollDir: string): Promise<NormalizedParcel[]> {
  // ── Step 1: load building details (sqft, year built) ──────────────────────
  console.log("  Loading RES_DETAIL.CSV (sqft / year built)…");
  const resMap = await streamCsvMap<{ sqft: number | null; yearBuilt: number | null }>(
    path.join(rollDir, "RES_DETAIL.CSV"),
    (row) => {
      const acct = row.ACCOUNT_NUM?.trim();
      if (!acct) return null;
      return [acct, {
        sqft:      parseNum(row.TOT_LIVING_AREA_SF),
        yearBuilt: parseYear(row.YR_BUILT),
      }];
    }
  );
  console.log(`  RES_DETAIL.CSV: ${resMap.size.toLocaleString()} records`);

  // ── Step 2: load situs addresses ──────────────────────────────────────────
  console.log("  Loading ACCOUNT_INFO.CSV (situs address)…");
  const addrMap = await streamCsvMap<{
    address: string; city: string | null; zip: string | null;
  }>(
    path.join(rollDir, "ACCOUNT_INFO.CSV"),
    (row) => {
      const acct = row.ACCOUNT_NUM?.trim();
      if (!acct) return null;
      const streetNum  = (row.STREET_NUM        ?? "").trim();
      const streetName = (row.FULL_STREET_NAME  ?? "").trim();
      const unit       = (row["UNIT_ID"]         ?? "").trim();
      const rawAddr    = [streetNum, streetName, unit ? `#${unit}` : ""]
        .filter(Boolean).join(" ");
      return [acct, {
        address: normalizeAddress(rawAddr),
        city:    row.PROPERTY_CITY?.trim()    || null,
        zip:     row.PROPERTY_ZIPCODE?.trim() || null,
      }];
    }
  );
  console.log(`  ACCOUNT_INFO.CSV: ${addrMap.size.toLocaleString()} records`);

  // ── Step 3: stream main value file ────────────────────────────────────────
  const valuePath = path.join(rollDir, "ACCOUNT_APPRL_YEAR.CSV");
  if (!fs.existsSync(valuePath))
    throw new Error(`ACCOUNT_APPRL_YEAR.CSV not found at ${valuePath}`);

  console.log("  Streaming ACCOUNT_APPRL_YEAR.CSV…");
  const parcels: NormalizedParcel[] = [];

  await new Promise<void>((resolve, reject) => {
    const parser = csv.parse({ columns: true, trim: true, skip_empty_lines: true });
    fs.createReadStream(valuePath, { encoding: "utf-8" }).pipe(parser);

    parser.on("readable", () => {
      let row: Record<string, string>;
      while ((row = parser.read()) !== null) {
        const acct = row.ACCOUNT_NUM?.trim();
        if (!acct) continue;

        const stateClass = row.SPTD_CODE?.trim();
        if (!RESIDENTIAL_CLASSES.has(stateClass)) continue;

        const marketValue = parseNum(row.TOT_VAL);
        if (!marketValue) continue;

        const addr = addrMap.get(acct);
        if (!addr?.address) continue;

        const res = resMap.get(acct);

        parcels.push({
          accountId:        acct,
          situsAddress:     addr.address,
          situsCity:        addr.city,
          situsZip:         addr.zip,
          neighborhoodCode: null,
          stateClass,
          marketValue,
          // HMSTD_CAP_VAL = capped total value (appraised value after homestead cap)
          assessedValue:    parseNum(row.HMSTD_CAP_VAL) ?? parseNum(row.TOT_VAL),
          landValue:        parseNum(row.LAND_VAL),
          improvementValue: parseNum(row.IMPR_VAL),
          livingSqft:       res?.sqft      ?? null,
          yearBuilt:        res?.yearBuilt  ?? null,
          qualityClass:     null,
          exemptions:       [],  // exemptions in APPLIED_STD_EXEMPT.CSV (join separately if needed)
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

  console.log(`\n  ACCOUNT_APPRL_YEAR.CSV: ${parcels.length.toLocaleString()} residential parcels`);
  return parcels;
}

const rollDir = process.env.DALLAS_ROLL_PATH ?? "";

const dallasConfig: CountyConfig = {
  slug: "dallas-tx",
  name: "Dallas County",
  state: "TX",
  rollPath: rollDir,
  protestDeadlineRule: "May 15 or 30 days after Notice of Appraised Value, whichever is later",
  arbFilingUrl: "https://www.dcad.org/resources/online-protest/",
  taxYear: 2026,

  // Typical City of Dallas / Dallas ISD parcel rates.
  // Rates vary significantly by city and ISD within Dallas County.
  jurisdictions: [
    { name: "Dallas County",  rate: 0.2175 },
    { name: "City of Dallas", rate: 0.7750 },
    { name: "Dallas ISD",     rate: 0.9050 },
  ],

  loadParcels(): Promise<NormalizedParcel[]> {
    if (!rollDir)
      throw new Error(
        "DALLAS_ROLL_PATH is not set.\n" +
        "1. Download the current year ZIP from https://www.dallascad.org/dataproducts.aspx\n" +
        "2. Extract to a directory (e.g. /tmp/dallas-roll/)\n" +
        "3. Set DALLAS_ROLL_PATH=/tmp/dallas-roll/ in .env.local"
      );
    return loadParcelsFn(rollDir);
  },
};

export default dallasConfig;
