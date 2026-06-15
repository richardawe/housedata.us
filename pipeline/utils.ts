// Address normalization: uppercase, expand common abbreviations,
// strip excess whitespace.
const SUFFIX_MAP: Record<string, string> = {
  ST: "ST",   STREET: "ST",
  AVE: "AVE", AVENUE: "AVE",
  BLVD: "BLVD", BOULEVARD: "BLVD",
  DR: "DR",   DRIVE: "DR",
  LN: "LN",   LANE: "LN",
  RD: "RD",   ROAD: "RD",
  CT: "CT",   COURT: "CT",
  PL: "PL",   PLACE: "PL",
  WAY: "WAY",
  TRL: "TRL", TRAIL: "TRL",
  PKWY: "PKWY", PARKWAY: "PKWY",
  HWY: "HWY", HIGHWAY: "HWY",
  LOOP: "LOOP", PASS: "PASS",
  CV: "CV",   COVE: "CV",
  HOLW: "HOLW", HOLLOW: "HOLW",
};

export function normalizeAddress(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b([A-Z]+)\b/g, (word) => SUFFIX_MAP[word] ?? word);
}

// Median of a numeric array (empty → null).
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

// Batch an array into chunks of size n.
export function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}
