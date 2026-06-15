import { Pool, types } from "pg";

// pg returns NUMERIC columns as strings by default. Parse them as JS floats.
// OID 1700 = numeric/decimal, 701 = float8, 700 = float4, 20 = int8
types.setTypeParser(1700, (v) => parseFloat(v));
types.setTypeParser(20, (v) => parseInt(v, 10));

// Singleton pool — reused across requests in both dev and cPanel Passenger.
// In production, set DATABASE_URL to the Neon connection string.
let _pool: Pool | undefined;

export function getPool(): Pool {
  if (!_pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    _pool = new Pool({
      connectionString: url,
      ssl: url.includes("neon.tech") ? { rejectUnauthorized: false } : false,
      max: 5,
    });
  }
  return _pool;
}

// Tagged-template style query helper that matches the neon() API used throughout.
// Returns rows as a plain array so callers don't need to change.
export function getDb() {
  const pool = getPool();

  // Return a tagged-template function so call sites look identical to neon().
  async function sql(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<Record<string, unknown>[]> {
    // Build a parameterized query from the template literal.
    let text = "";
    strings.forEach((s, i) => {
      text += s;
      if (i < values.length) text += `$${i + 1}`;
    });
    const result = await pool.query(text, values as unknown[]);
    return result.rows;
  }

  return sql;
}
