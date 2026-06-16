import type { CountyConfig, NormalizedParcel } from "../types";
import { normalizeAddress } from "../utils";

// Collin County CAD (CCAD) — 2025 appraisal roll
//
// Data source: Texas Open Data Portal (single flat CSV, no login required)
//   https://data.texas.gov/dataset/Collin-CAD-Appraisal-Data-2025/vffy-snc6
//
// Download options:
//   A) Direct CSV: https://data.texas.gov/api/views/vffy-snc6/rows.csv?accessType=DOWNLOAD
//   B) Socrata API (paginated): https://data.texas.gov/resource/vffy-snc6.csv?$limit=500000
//
// Set COLLIN_ROLL_PATH to the local .csv file path.
// File is ~479K rows × 101 columns, one row per property (all types mixed).

const rollPath = process.env.COLLIN_ROLL_PATH ?? "";

const collinConfig: CountyConfig = {
  slug: "collin-tx",
  name: "Collin County",
  state: "TX",
  rollPath,
  protestDeadlineRule: "May 15 or 30 days after Notice of Appraised Value, whichever is later",
  arbFilingUrl: "https://www.collincad.org/online-protest/",
  taxYear: 2025,

  // Rates vary widely by city/ISD (Plano, Frisco, McKinney, Allen, Celina, etc.).
  // These represent a typical Plano/Collin County ISD parcel.
  // Source: 2025 certified rates — update per jurisdiction as needed.
  jurisdictions: [
    { name: "Collin County",   rate: 0.1520 },
    { name: "Plano ISD",       rate: 0.9710 },
    { name: "City of Plano",   rate: 0.4400 },
  ],

  parseRow(row: Record<string, string>): NormalizedParcel | null {
    // Keep only residential real property
    if (row.propType !== "Real" || row.propSubType !== "Residential") return null;

    const marketValue = parseFloat(row.currValMarket);
    if (!marketValue || marketValue <= 0) return null;

    // Prefer component fields; fall back to concatenated situs
    const assembled = [
      row.situsBldgNum,
      row.situsStreetPrefix,
      row.situsStreetName,
      row.situsStreetSuffix,
      row.situsUnit ? `#${row.situsUnit}` : "",
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    const situsAddress = normalizeAddress(assembled || row.situsConcat || "");
    if (!situsAddress) return null;

    const exemptions: string[] = [];
    const codes = (row.exemptCodes ?? "").toUpperCase();
    // exemptHmstdFlag is "true"/"false" string in this file
    if (row.exemptHmstdFlag === "true" || row.exemptHmstdFlag === "Y" || codes.includes("HS"))
      exemptions.push("HS");
    if (codes.includes("OV65")) exemptions.push("OV65");
    if (codes.includes("DP"))   exemptions.push("DP");

    return {
      accountId:        row.propID || row.geoID,
      situsAddress,
      situsCity:        row.situsCity?.trim()  || null,
      situsZip:         row.situsZip?.trim()   || null,
      neighborhoodCode: row.nbhdCode?.trim()   || null,
      stateClass:       row.propCategoryCode?.trim() || null,
      marketValue,
      assessedValue:    parseFloat(row.currValAssessed)  || null,
      landValue:        parseFloat(row.currValLand)      || null,
      improvementValue: parseFloat(row.currValImprv)     || null,
      livingSqft:       parseFloat(row.imprvMainArea)    || null,
      yearBuilt:        parseInt(row.imprvYearBuilt, 10) || null,
      qualityClass:     row.imprvClassCd?.trim()        || null,
      exemptions,
      lat: null,
      lng: null,
    };
  },
};

export default collinConfig;
