#!/usr/bin/env ts-node
/**
 * Pipeline orchestrator — run once per tax year after downloading the roll.
 *
 * Usage:
 *   ts-node --project tsconfig.pipeline.json pipeline/run.ts \
 *     --county travis-tx \
 *     --roll /path/to/appraisal_roll.zip \
 *     [--year 2025]
 *
 * Prerequisites:
 *   - DATABASE_URL must be set in .env.local or the environment
 *   - Run lib/db/schema.sql against your Neon database first
 */

import "dotenv/config";
import { Pool } from "pg";
import travisConfig from "./counties/travis-tx";
import { loadRoll } from "./loader";
import { loadTaxRates } from "./tax-rates";
import { runCompsEngine } from "./comps-engine";
import type { CountyConfig } from "./types";

const COUNTIES: Record<string, CountyConfig> = {
  "travis-tx": travisConfig,
};

async function main() {
  const args = process.argv.slice(2);
  const countySlug = args[args.indexOf("--county") + 1] ?? "travis-tx";
  const rollIdx = args.indexOf("--roll");
  const rollPath = rollIdx >= 0 ? args[rollIdx + 1] ?? "" : "";
  const taxYear = args.indexOf("--year") >= 0
    ? parseInt(args[args.indexOf("--year") + 1], 10)
    : undefined;

  const config = COUNTIES[countySlug];
  if (!config) {
    console.error(`Unknown county: ${countySlug}. Available: ${Object.keys(COUNTIES).join(", ")}`);
    process.exit(1);
  }

  if (rollPath) config.rollPath = rollPath;
  if (taxYear) config.taxYear = taxYear;

  const dbUrl = process.env.DATABASE_URL ?? "";
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes("neon.tech") ? { rejectUnauthorized: false } : false,
  });

  console.log(`\n=== housedata.us pipeline ===`);
  console.log(`County: ${config.name} (${config.slug})`);
  console.log(`Tax year: ${config.taxYear}`);
  console.log(`Roll: ${config.rollPath || "(not set)"}\n`);

  const { countyId, loaded } = await loadRoll(config, pool);
  console.log(`✓ Roll loaded: ${loaded.toLocaleString()} residential parcels`);

  await loadTaxRates(config, countyId, pool);
  console.log(`✓ Tax rates loaded`);

  await runCompsEngine(countyId, config.taxYear, pool);
  console.log(`✓ Comps engine complete`);

  await pool.end();
  console.log(`\nPipeline done. Review results in the analysis table.\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
