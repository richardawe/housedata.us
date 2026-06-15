import { Pool } from "pg";
import type { CountyConfig } from "./types";

export async function loadTaxRates(
  config: CountyConfig,
  countyId: number,
  pool: Pool
): Promise<void> {
  const client = await pool.connect();
  try {
    for (const { name, rate } of config.jurisdictions) {
      await client.query(
        `INSERT INTO tax_rates (county_id, tax_year, jurisdiction, rate)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (county_id, tax_year, jurisdiction) DO UPDATE SET rate = EXCLUDED.rate`,
        [countyId, config.taxYear, name, rate]
      );
    }
    console.log(`Loaded ${config.jurisdictions.length} tax rate rows for ${config.slug}`);
  } finally {
    client.release();
  }
}

// Returns combined rate per $1 of taxable value (divide the per-$100 rate by 100).
export async function getCombinedRate(
  countyId: number,
  taxYear: number,
  pool: Pool
): Promise<number> {
  const res = await pool.query(
    `SELECT COALESCE(SUM(rate), 0) AS total FROM tax_rates
     WHERE county_id = $1 AND tax_year = $2`,
    [countyId, taxYear]
  );
  return parseFloat(res.rows[0].total) / 100;
}
