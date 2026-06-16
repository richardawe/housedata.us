import fs from "fs";
import path from "path";
import readline from "readline";
import type { CountyConfig, NormalizedParcel } from "../types";
import { normalizeAddress } from "../utils";

// Tarrant County Appraisal District (TAD) — 2025 appraisal roll
//
// Data source: https://www.tad.org/resources/data-downloads
//   → Download "PropertyData-Residential" (pipe-delimited .txt)
//
// Set TARRANT_ROLL_PATH to the local .txt file path.
//
// Format: pipe-delimited (|), one property record per line, WITH header row.
// Field layout: TAD PropertyData Export Layout PDF (available on tad.org).
//
// Note: TAD file may use a hierarchical multi-record format where each property
// spans multiple lines (Property header + Segment + Land sub-records).
// If a single line per property is confirmed, this parseRow approach works directly.
// If the file is hierarchical, switch to loadParcels and group lines by PropertyID.
//
// ~1.9M total parcels; "PropertyData-Residential" pre-filters to residential.

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

async function loadParcelsFn(rollPath: string): Promise<NormalizedParcel[]> {
  if (!fs.existsSync(rollPath))
    throw new Error(`TAD file not found: ${rollPath}`);

  const rl = readline.createInterface({
    input: fs.createReadStream(rollPath, { encoding: "latin1" }),
    crlfDelay: Infinity,
  });

  const parcels: NormalizedParcel[] = [];
  let headers: string[] | null = null;

  for await (const line of rl) {
    const fields = line.split("|");

    // First line is the header row
    if (headers === null) {
      headers = fields.map((h) => h.trim());
      continue;
    }

    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (fields[i] ?? "").trim(); });

    const stateClass = row.StateCode?.trim();
    if (stateClass && !RESIDENTIAL_CLASSES.has(stateClass)) continue;

    const marketValue = parseNum(row.CurrMarketValue);
    if (!marketValue) continue;

    // Assemble address: prefer component fields, fall back to Situs concat
    const streetNum  = row.SitusStreetNumber ?? "";
    const streetName = row.SitusStreetName   ?? "";
    const rawAddr    = [streetNum, streetName].filter(Boolean).join(" ").trim()
                    || row.Situs             || "";

    const situsAddress = normalizeAddress(rawAddr);
    if (!situsAddress) continue;

    const exemptions: string[] = [];
    // TAD exemptions are in a separate PropertyData_Exemptions file.
    // Load that file separately if exemption-aware analysis is needed.

    parcels.push({
      accountId:        row.PropertyID || row.QuickRefID,
      situsAddress,
      situsCity:        row.SitusCity?.trim() || null,
      situsZip:         row.SitusZip?.trim()  || null,
      neighborhoodCode: null,
      stateClass:       stateClass || null,
      marketValue,
      // CurrAssessedValue = value after homestead cap; fall back to market if absent
      assessedValue:    parseNum(row.CurrAssessedValue) ?? parseNum(row.CurrMarketValue),
      landValue:        parseNum(row.CurrLandValue),
      improvementValue: parseNum(row.CurrImprovmentValue),  // TAD spells it "Improvment"
      // SquareFootage is on the Property record; ActYrBuilt is in the Segment sub-record
      livingSqft:       parseNum(row.SquareFootage),
      yearBuilt:        parseYear(row.ActYrBuilt),
      qualityClass:     null,
      exemptions,
      lat: null,
      lng: null,
    });

    if (parcels.length % 10000 === 0)
      process.stdout.write(`  ${parcels.length.toLocaleString()} parcels\r`);
  }

  console.log(`\n  TAD file: ${parcels.length.toLocaleString()} residential parcels`);
  return parcels;
}

const rollPath = process.env.TARRANT_ROLL_PATH ?? "";

const tarrantConfig: CountyConfig = {
  slug: "tarrant-tx",
  name: "Tarrant County",
  state: "TX",
  rollPath,
  protestDeadlineRule: "May 15 or 30 days after Notice of Appraised Value, whichever is later",
  arbFilingUrl: "https://www.tad.org/resources/online-protest/",
  taxYear: 2025,

  // Typical Fort Worth / Tarrant County / Fort Worth ISD rates.
  // Rates vary by city (Fort Worth, Arlington, Grapevine, etc.) and ISD.
  jurisdictions: [
    { name: "Tarrant County",        rate: 0.2290 },
    { name: "City of Fort Worth",    rate: 0.7125 },
    { name: "Fort Worth ISD",        rate: 0.8929 },
    { name: "Tarrant County College", rate: 0.1301 },
  ],

  loadParcels(): Promise<NormalizedParcel[]> {
    if (!rollPath)
      throw new Error(
        "TARRANT_ROLL_PATH is not set.\n" +
        "1. Download 'PropertyData-Residential' from https://www.tad.org/resources/data-downloads\n" +
        "2. Set TARRANT_ROLL_PATH=/path/to/PropertyData-Residential.txt in .env.local"
      );
    return loadParcelsFn(rollPath);
  },
};

export default tarrantConfig;
