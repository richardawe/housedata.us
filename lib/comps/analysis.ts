import { median } from "../../pipeline/utils";

export type SavingsCase = "clear" | "partial" | "capped";
export type CompQuality = "strict" | "relaxed_sqft" | "relaxed_year" | "zip";

export interface ParcelInput {
  id: bigint;
  marketValue: number;
  assessedValue: number;
  livingSqft: number;
  yearBuilt: number;
  neighborhoodCode: string | null;
  stateClass: string;
  situsZip: string | null;
  taxYear: number;
  improvementValue: number | null;
}

export interface AnalysisResult {
  parcelId: bigint;
  taxYear: number;
  compCount: number;
  compQuality: CompQuality;
  medianCompPsf: number | null;
  subjectPsf: number | null;
  pctAbove: number | null;
  impliedValue: number | null;
  grossOverassessment: number;
  savingsCase: SavingsCase;
  annualSavings: number;
  compIds: bigint[];
  lowConfidence: boolean;
  lowConfidenceReason: string | null;
}

export interface CompCandidate {
  id: bigint;
  marketValue: number;
  livingSqft: number;
  yearBuilt: number;
  neighborhoodCode: string | null;
  stateClass: string;
  situsZip: string | null;
}

const MIN_COMPS = 5;

// ─────────────────────────────────────────────────────────────────────────────
// Comp selection — 4-level fallback chain (spec §5.1)
// Returns selected comps and the quality level used.
// ─────────────────────────────────────────────────────────────────────────────
export function selectComps(
  subject: ParcelInput,
  pool: CompCandidate[]
): { comps: CompCandidate[]; quality: CompQuality } {
  const candidates = pool.filter((c) => c.id !== subject.id);

  function sqftInRange(c: CompCandidate, pct: number) {
    const lo = subject.livingSqft * (1 - pct);
    const hi = subject.livingSqft * (1 + pct);
    return c.livingSqft >= lo && c.livingSqft <= hi;
  }

  function yearInRange(c: CompCandidate, years: number) {
    return Math.abs((c.yearBuilt ?? 0) - subject.yearBuilt) <= years;
  }

  // Level 1: strict
  let comps = candidates.filter(
    (c) =>
      c.neighborhoodCode === subject.neighborhoodCode &&
      c.stateClass === subject.stateClass &&
      sqftInRange(c, 0.15) &&
      yearInRange(c, 10)
  );
  if (comps.length >= MIN_COMPS) return { comps, quality: "strict" };

  // Level 2: relax sqft to ±20%
  comps = candidates.filter(
    (c) =>
      c.neighborhoodCode === subject.neighborhoodCode &&
      c.stateClass === subject.stateClass &&
      sqftInRange(c, 0.20) &&
      yearInRange(c, 10)
  );
  if (comps.length >= MIN_COMPS) return { comps, quality: "relaxed_sqft" };

  // Level 3: relax year to ±15
  comps = candidates.filter(
    (c) =>
      c.neighborhoodCode === subject.neighborhoodCode &&
      c.stateClass === subject.stateClass &&
      sqftInRange(c, 0.20) &&
      yearInRange(c, 15)
  );
  if (comps.length >= MIN_COMPS) return { comps, quality: "relaxed_year" };

  // Level 4: fall back to same zip + same class (drop neighborhood)
  comps = candidates.filter(
    (c) =>
      c.situsZip === subject.situsZip &&
      c.stateClass === subject.stateClass &&
      sqftInRange(c, 0.20) &&
      yearInRange(c, 15)
  );
  // Return whatever we have at the zip level (may be < 5)
  return { comps, quality: "zip" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Analysis computation (spec §5.2 + §5.3)
// combinedRate: per $1 of taxable value (e.g. 0.0207 for $2.07/$100)
// ─────────────────────────────────────────────────────────────────────────────
export function analyzeParcel(
  subject: ParcelInput,
  comps: CompCandidate[],
  quality: CompQuality,
  combinedRate: number
): AnalysisResult {
  const base: Omit<AnalysisResult, "savingsCase" | "annualSavings"> = {
    parcelId: subject.id,
    taxYear: subject.taxYear,
    compCount: comps.length,
    compQuality: quality,
    medianCompPsf: null,
    subjectPsf: null,
    pctAbove: null,
    impliedValue: null,
    grossOverassessment: 0,
    compIds: comps.map((c) => c.id),
    lowConfidence: false,
    lowConfidenceReason: null,
  };

  // Flag low-confidence cases (spec §10)
  const improvementJump =
    subject.improvementValue != null &&
    subject.improvementValue > 0 &&
    subject.marketValue / subject.improvementValue > 1.5;

  if (subject.yearBuilt === subject.taxYear) {
    base.lowConfidence = true;
    base.lowConfidenceReason = "New construction — equity comps may not apply yet";
  } else if (improvementJump) {
    base.lowConfidence = true;
    base.lowConfidenceReason = "Recent large improvement — value change may be legitimate";
  }

  if (!comps.length) {
    return { ...base, savingsCase: "capped", annualSavings: 0 };
  }

  const psfs = comps
    .filter((c) => c.livingSqft > 0)
    .map((c) => c.marketValue / c.livingSqft);

  const medianPsf = median(psfs);
  if (!medianPsf) return { ...base, savingsCase: "capped", annualSavings: 0 };

  const subjectPsf = subject.marketValue / subject.livingSqft;
  const impliedValue = medianPsf * subject.livingSqft;
  const pctAbove = (subjectPsf - medianPsf) / medianPsf;
  const grossOverassessment = Math.max(0, subject.marketValue - impliedValue);

  // Homestead cap logic (spec §5.3)
  const effectiveNewTaxable = Math.min(subject.assessedValue, impliedValue);
  const taxableDelta = Math.max(0, subject.assessedValue - effectiveNewTaxable);
  const annualSavings = taxableDelta * combinedRate;

  let savingsCase: SavingsCase;
  if (impliedValue < subject.assessedValue) {
    savingsCase = "clear";
  } else if (impliedValue < subject.marketValue) {
    savingsCase = "partial";
  } else {
    savingsCase = "capped";
  }

  // Critical invariant: capped must always produce $0 savings
  const finalSavings = savingsCase === "capped" ? 0 : Math.round(annualSavings);

  return {
    ...base,
    medianCompPsf: medianPsf,
    subjectPsf,
    pctAbove,
    impliedValue,
    grossOverassessment,
    savingsCase,
    annualSavings: finalSavings,
  };
}
