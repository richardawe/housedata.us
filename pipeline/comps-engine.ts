import { Pool } from "pg";
import { selectComps, analyzeParcel } from "../lib/comps/analysis";
import type { ParcelInput, CompCandidate } from "../lib/comps/analysis";
import { getCombinedRate } from "./tax-rates";

const PAGE_SIZE = 1000;

export async function runCompsEngine(
  countyId: number,
  taxYear: number,
  pool: Pool
): Promise<void> {
  const combinedRate = await getCombinedRate(countyId, taxYear, pool);
  console.log(`Combined tax rate: ${(combinedRate * 100).toFixed(4)}% (${(combinedRate * 100).toFixed(2)}¢/$1)`);

  // Count total eligible parcels
  const countRes = await pool.query(
    `SELECT COUNT(*) FROM parcels
     WHERE county_id = $1 AND tax_year = $2
       AND living_sqft > 0 AND market_value > 0 AND assessed_value > 0`,
    [countyId, taxYear]
  );
  const total = parseInt(countRes.rows[0].count, 10);
  console.log(`Running comps engine on ${total.toLocaleString()} parcels...`);

  let processed = 0;
  let offset = 0;

  while (offset < total) {
    // Load a page of subject parcels
    const subjectRes = await pool.query(
      `SELECT id, market_value, assessed_value, living_sqft, year_built,
              neighborhood_code, state_class, situs_zip, tax_year, improvement_value
       FROM parcels
       WHERE county_id = $1 AND tax_year = $2
         AND living_sqft > 0 AND market_value > 0 AND assessed_value > 0
       ORDER BY id
       LIMIT $3 OFFSET $4`,
      [countyId, taxYear, PAGE_SIZE, offset]
    );

    for (const row of subjectRes.rows) {
      const subject: ParcelInput = {
        id: BigInt(row.id),
        marketValue: parseFloat(row.market_value),
        assessedValue: parseFloat(row.assessed_value),
        livingSqft: parseFloat(row.living_sqft),
        yearBuilt: parseInt(row.year_built, 10),
        neighborhoodCode: row.neighborhood_code,
        stateClass: row.state_class,
        situsZip: row.situs_zip,
        taxYear: parseInt(row.tax_year, 10),
        improvementValue: row.improvement_value ? parseFloat(row.improvement_value) : null,
      };

      // Load comp candidates for this subject's neighborhood/zip
      const compRes = await pool.query(
        `SELECT id, market_value, living_sqft, year_built,
                neighborhood_code, state_class, situs_zip
         FROM parcels
         WHERE county_id = $1 AND tax_year = $2
           AND state_class = $3
           AND (neighborhood_code = $4 OR situs_zip = $5)
           AND living_sqft > 0 AND market_value > 0
           AND id != $6`,
        [countyId, taxYear, subject.stateClass,
         subject.neighborhoodCode, subject.situsZip, row.id]
      );

      const candidates: CompCandidate[] = compRes.rows.map((c) => ({
        id: BigInt(c.id),
        marketValue: parseFloat(c.market_value),
        livingSqft: parseFloat(c.living_sqft),
        yearBuilt: parseInt(c.year_built, 10),
        neighborhoodCode: c.neighborhood_code,
        stateClass: c.state_class,
        situsZip: c.situs_zip,
      }));

      const { comps, quality } = selectComps(subject, candidates);
      const result = analyzeParcel(subject, comps, quality, combinedRate);

      await pool.query(
        `INSERT INTO analysis
           (parcel_id, tax_year, comp_count, comp_quality,
            median_comp_psf, subject_psf, pct_above, implied_value,
            gross_overassessment, savings_case, annual_savings, comp_ids)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (parcel_id) DO UPDATE SET
           tax_year           = EXCLUDED.tax_year,
           comp_count         = EXCLUDED.comp_count,
           comp_quality       = EXCLUDED.comp_quality,
           median_comp_psf    = EXCLUDED.median_comp_psf,
           subject_psf        = EXCLUDED.subject_psf,
           pct_above          = EXCLUDED.pct_above,
           implied_value      = EXCLUDED.implied_value,
           gross_overassessment = EXCLUDED.gross_overassessment,
           savings_case       = EXCLUDED.savings_case,
           annual_savings     = EXCLUDED.annual_savings,
           comp_ids           = EXCLUDED.comp_ids`,
        [
          row.id, result.taxYear,
          result.compCount, result.compQuality,
          result.medianCompPsf, result.subjectPsf, result.pctAbove,
          result.impliedValue, result.grossOverassessment,
          result.savingsCase, result.annualSavings,
          result.compIds.map(String),
        ]
      );

      processed++;
    }

    // Compute aggregate stats for zips and neighborhoods touched by this page
    await computeAggregates(countyId, taxYear, pool, subjectRes.rows);

    offset += PAGE_SIZE;
    process.stdout.write(`  ${processed.toLocaleString()} / ${total.toLocaleString()} processed\r`);
  }

  console.log(`\nComps engine complete. ${processed.toLocaleString()} parcels analyzed.`);
}

async function computeAggregates(
  countyId: number,
  taxYear: number,
  pool: Pool,
  rows: Array<{ situs_zip: string | null; neighborhood_code: string | null }>
) {
  const zips = [...new Set(rows.map((r) => r.situs_zip).filter(Boolean) as string[])];
  const nbhds = [...new Set(rows.map((r) => r.neighborhood_code).filter(Boolean) as string[])];

  for (const zip of zips) {
    await pool.query(
      `INSERT INTO zip_stats (county_id, tax_year, situs_zip, total_parcels, pct_above_median, avg_overassessment)
       SELECT
         $1, $2, $3,
         COUNT(*),
         ROUND(100.0 * COUNT(*) FILTER (WHERE a.pct_above > 0) / NULLIF(COUNT(*), 0), 1),
         ROUND(AVG(a.gross_overassessment) FILTER (WHERE a.gross_overassessment > 0), 0)
       FROM parcels p
       JOIN analysis a ON a.parcel_id = p.id
       WHERE p.county_id = $1 AND p.tax_year = $2 AND p.situs_zip = $3
       ON CONFLICT (county_id, tax_year, situs_zip) DO UPDATE SET
         total_parcels      = EXCLUDED.total_parcels,
         pct_above_median   = EXCLUDED.pct_above_median,
         avg_overassessment = EXCLUDED.avg_overassessment`,
      [countyId, taxYear, zip]
    );
  }

  for (const nbhd of nbhds) {
    await pool.query(
      `INSERT INTO neighborhood_stats (county_id, tax_year, neighborhood_code, total_parcels, pct_above_median, avg_overassessment)
       SELECT
         $1, $2, $3,
         COUNT(*),
         ROUND(100.0 * COUNT(*) FILTER (WHERE a.pct_above > 0) / NULLIF(COUNT(*), 0), 1),
         ROUND(AVG(a.gross_overassessment) FILTER (WHERE a.gross_overassessment > 0), 0)
       FROM parcels p
       JOIN analysis a ON a.parcel_id = p.id
       WHERE p.county_id = $1 AND p.tax_year = $2 AND p.neighborhood_code = $3
       ON CONFLICT (county_id, tax_year, neighborhood_code) DO UPDATE SET
         total_parcels      = EXCLUDED.total_parcels,
         pct_above_median   = EXCLUDED.pct_above_median,
         avg_overassessment = EXCLUDED.avg_overassessment`,
      [countyId, taxYear, nbhd]
    );
  }
}
