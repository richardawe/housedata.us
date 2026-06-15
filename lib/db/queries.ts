import { getDb } from "./client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rows<T = any>(result: Record<string, unknown>[]): T[] {
  return result as unknown as T[];
}

export interface ParcelResult {
  id: string;
  account_id: string;
  county_slug: string;
  situs_address: string;
  situs_city: string | null;
  situs_zip: string | null;
  tax_year: number;
  market_value: number | null;
  assessed_value: number | null;
  living_sqft: number | null;
  year_built: number | null;
  exemptions: string[] | null;
  // analysis fields
  comp_count: number | null;
  comp_quality: string | null;
  median_comp_psf: number | null;
  subject_psf: number | null;
  pct_above: number | null;
  implied_value: number | null;
  gross_overassessment: number | null;
  savings_case: "clear" | "partial" | "capped" | null;
  annual_savings: number | null;
  comp_ids: string[] | null;
}

export interface CompRow {
  id: string;
  account_id: string;
  situs_address: string;
  situs_zip: string | null;
  living_sqft: number | null;
  year_built: number | null;
  market_value: number | null;
  psf: number | null;
}

export async function searchAddresses(query: string, countySlug: string, limit = 5) {
  const sql = getDb();
  const result = await sql`
    SELECT p.account_id, p.situs_address, p.situs_city, p.situs_zip, c.slug AS county_slug
    FROM parcels p
    JOIN counties c ON c.id = p.county_id
    WHERE c.slug = ${countySlug}
      AND p.situs_address ILIKE ${'%' + query + '%'}
    ORDER BY p.situs_address
    LIMIT ${limit}
  `;
  return rows(result);
}

export async function getParcelWithAnalysis(
  countySlug: string,
  accountId: string
): Promise<ParcelResult | null> {
  const sql = getDb();
  const result = await sql`
    SELECT
      p.id, p.account_id, c.slug AS county_slug,
      p.situs_address, p.situs_city, p.situs_zip,
      p.tax_year, p.market_value, p.assessed_value,
      p.living_sqft, p.year_built, p.exemptions,
      a.comp_count, a.comp_quality,
      a.median_comp_psf, a.subject_psf, a.pct_above,
      a.implied_value, a.gross_overassessment,
      a.savings_case, a.annual_savings, a.comp_ids
    FROM parcels p
    JOIN counties c ON c.id = p.county_id
    LEFT JOIN analysis a ON a.parcel_id = p.id
    WHERE c.slug = ${countySlug}
      AND p.account_id = ${accountId}
    ORDER BY p.tax_year DESC
    LIMIT 1
  `;
  return rows<ParcelResult>(result)[0] ?? null;
}

export async function getCompRows(compIds: string[]): Promise<CompRow[]> {
  if (!compIds.length) return [];
  const sql = getDb();
  const result = await sql`
    SELECT
      p.id, p.account_id, p.situs_address, p.situs_zip,
      p.living_sqft, p.year_built, p.market_value,
      CASE WHEN p.living_sqft > 0 THEN p.market_value / p.living_sqft ELSE NULL END AS psf
    FROM parcels p
    WHERE p.id = ANY(${compIds}::bigint[])
  `;
  return rows<CompRow>(result);
}

export async function getZipStats(countySlug: string, zip: string, taxYear: number) {
  const sql = getDb();
  const result = await sql`
    SELECT zs.*
    FROM zip_stats zs
    JOIN counties c ON c.id = zs.county_id
    WHERE c.slug = ${countySlug}
      AND zs.situs_zip = ${zip}
      AND zs.tax_year = ${taxYear}
    LIMIT 1
  `;
  return rows(result)[0] ?? null;
}

export async function getCounty(slug: string) {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM counties WHERE slug = ${slug} LIMIT 1
  `;
  return rows(result)[0] ?? null;
}

export async function getOrder(orderId: string) {
  const sql = getDb();
  const result = await sql`
    SELECT o.*, p.account_id, p.situs_address, c.slug AS county_slug
    FROM orders o
    JOIN parcels p ON p.id = o.parcel_id
    JOIN counties c ON c.id = p.county_id
    WHERE o.id = ${orderId}
    LIMIT 1
  `;
  return rows(result)[0] ?? null;
}

export async function getOrderBySession(sessionId: string) {
  const sql = getDb();
  const result = await sql`
    SELECT * FROM orders WHERE stripe_session_id = ${sessionId} LIMIT 1
  `;
  return rows(result)[0] ?? null;
}

export async function createOrder(data: {
  parcelId: string;
  email: string;
  ownerName: string;
  stripeSessionId: string;
}) {
  const sql = getDb();
  const result = await sql`
    INSERT INTO orders (parcel_id, email, owner_name, stripe_session_id, status)
    VALUES (${data.parcelId}, ${data.email}, ${data.ownerName}, ${data.stripeSessionId}, 'paid')
    ON CONFLICT (stripe_session_id) DO NOTHING
    RETURNING id
  `;
  return rows(result)[0] ?? null;
}

export async function markOrderDelivered(orderId: string, packetPath: string) {
  const sql = getDb();
  await sql`
    UPDATE orders
    SET status = 'delivered', packet_path = ${packetPath}, delivered_at = now()
    WHERE id = ${orderId}
  `;
}
