import fs from "fs";
import path from "path";
import { createReadStream, existsSync } from "fs";
import { createGunzip } from "zlib";
import { pipeline as streamPipeline } from "stream/promises";
import * as csv from "csv-parse";
import AdmZip from "adm-zip";
import { Pool } from "pg";
import type { CountyConfig, NormalizedParcel } from "./types";
import { chunk } from "./utils";

const BATCH_SIZE = 500;

export async function loadRoll(
  config: CountyConfig,
  pool: Pool
): Promise<{ countyId: number; loaded: number; skipped: number }> {
  const client = await pool.connect();
  try {
    // Upsert county row
    const countyRes = await client.query(
      `INSERT INTO counties (slug, name, state, protest_deadline_rule, arb_filing_url)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         protest_deadline_rule = EXCLUDED.protest_deadline_rule,
         arb_filing_url = EXCLUDED.arb_filing_url
       RETURNING id`,
      [
        config.slug,
        config.name,
        config.state,
        config.protestDeadlineRule,
        config.arbFilingUrl,
      ]
    );
    const countyId: number = countyRes.rows[0].id;

    let loaded = 0;
    let skipped = 0;

    const flushBatch = async (batch: NormalizedParcel[]) => {
      if (!batch.length) return;

      const values: unknown[] = [];
      const placeholders = batch.map((p, i) => {
        const base = i * 18;
        values.push(
          countyId, config.taxYear,
          p.accountId, p.situsAddress, p.situsCity, p.situsZip,
          p.neighborhoodCode, p.stateClass,
          p.marketValue, p.assessedValue, p.landValue, p.improvementValue,
          p.livingSqft, p.yearBuilt, p.qualityClass,
          p.exemptions, p.lat, p.lng
        );
        return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9},$${base+10},$${base+11},$${base+12},$${base+13},$${base+14},$${base+15},$${base+16},$${base+17},$${base+18})`;
      });

      await client.query(
        `INSERT INTO parcels
           (county_id, tax_year, account_id, situs_address, situs_city, situs_zip,
            neighborhood_code, state_class, market_value, assessed_value,
            land_value, improvement_value, living_sqft, year_built, quality_class,
            exemptions, lat, lng)
         VALUES ${placeholders.join(",")}
         ON CONFLICT (county_id, tax_year, account_id) DO UPDATE SET
           situs_address     = EXCLUDED.situs_address,
           situs_city        = EXCLUDED.situs_city,
           situs_zip         = EXCLUDED.situs_zip,
           neighborhood_code = EXCLUDED.neighborhood_code,
           state_class       = EXCLUDED.state_class,
           market_value      = EXCLUDED.market_value,
           assessed_value    = EXCLUDED.assessed_value,
           land_value        = EXCLUDED.land_value,
           improvement_value = EXCLUDED.improvement_value,
           living_sqft       = EXCLUDED.living_sqft,
           year_built        = EXCLUDED.year_built,
           quality_class     = EXCLUDED.quality_class,
           exemptions        = EXCLUDED.exemptions,
           lat               = EXCLUDED.lat,
           lng               = EXCLUDED.lng`,
        values
      );

      loaded += batch.length;
      if (loaded % 10000 === 0) process.stdout.write(`  ${loaded.toLocaleString()} parcels loaded\r`);
    };

    if (config.loadParcels) {
      // Fixed-width / multi-file county: county adapter handles all file reading
      console.log(`Loading roll for ${config.slug} via loadParcels()…`);
      const allParcels = await config.loadParcels();

      for (let i = 0; i < allParcels.length; i += BATCH_SIZE) {
        await flushBatch(allParcels.slice(i, i + BATCH_SIZE));
      }
    } else if (config.parseRow) {
      // Standard CSV path
      const csvPath = resolveCsvPath(config.rollPath);
      console.log(`Loading roll from: ${csvPath}`);

      let csvBatch: NormalizedParcel[] = [];
      await new Promise<void>((resolve, reject) => {
        const parser = csv.parse({ columns: true, trim: true, skip_empty_lines: true });
        parser.on("readable", async () => {
          let row: Record<string, string>;
          while ((row = parser.read()) !== null) {
            parser.pause();
            const parsed = config.parseRow!(row);
            if (parsed) {
              csvBatch.push(parsed);
            } else {
              skipped++;
            }
            if (csvBatch.length >= BATCH_SIZE) {
              await flushBatch(csvBatch);
              csvBatch = [];
            }
            parser.resume();
          }
        });
        parser.on("end", async () => { await flushBatch(csvBatch); resolve(); });
        parser.on("error", reject);
        createReadStream(csvPath).pipe(parser);
      });
    } else {
      throw new Error(`County config for ${config.slug} must implement either loadParcels or parseRow`);
    }

    console.log(`\nLoaded ${loaded.toLocaleString()} parcels, skipped ${skipped.toLocaleString()}`);
    return { countyId, loaded, skipped };
  } finally {
    client.release();
  }
}

function resolveCsvPath(rollPath: string): string {
  if (!rollPath) {
    throw new Error(
      "Roll path not set. Set TRAVIS_ROLL_PATH or pass --roll <path> to the CLI."
    );
  }
  if (!existsSync(rollPath)) throw new Error(`Roll file not found: ${rollPath}`);
  const ext = path.extname(rollPath).toLowerCase();
  if (ext === ".csv") return rollPath;
  if (ext === ".zip") {
    // Extract first CSV from ZIP to a temp file
    const zip = new AdmZip(rollPath);
    const csvEntry = zip.getEntries().find((e) => e.entryName.endsWith(".csv"));
    if (!csvEntry) throw new Error("No CSV found inside ZIP");
    const tmpPath = path.join("/tmp", csvEntry.entryName.replace(/.*\//, ""));
    zip.extractEntryTo(csvEntry, "/tmp", false, true);
    return tmpPath;
  }
  throw new Error(`Unsupported roll format: ${ext}. Expected .csv or .zip`);
}
