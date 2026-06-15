import { describe, it, expect } from "vitest";
import { selectComps, analyzeParcel } from "../analysis";
import type { ParcelInput, CompCandidate } from "../analysis";

// Combined rate: ~2.07% per $100 → 0.0207 per $1
const RATE = 0.0207;
const TAX_YEAR = 2025;

function makeSubject(overrides: Partial<ParcelInput> = {}): ParcelInput {
  return {
    id: 1n,
    marketValue: 500_000,
    assessedValue: 400_000,
    livingSqft: 2000,
    yearBuilt: 2005,
    neighborhoodCode: "NBHD1",
    stateClass: "A1",
    situsZip: "78745",
    taxYear: TAX_YEAR,
    improvementValue: 350_000,
    ...overrides,
  };
}

function makeComp(id: bigint, psf: number, overrides: Partial<CompCandidate> = {}): CompCandidate {
  return {
    id,
    marketValue: psf * 2000,
    livingSqft: 2000,
    yearBuilt: 2005,
    neighborhoodCode: "NBHD1",
    stateClass: "A1",
    situsZip: "78745",
    ...overrides,
  };
}

// 5 comps all at $200/sqft → median = $200, implied = $400k
const BASE_COMPS: CompCandidate[] = [
  makeComp(2n, 200),
  makeComp(3n, 200),
  makeComp(4n, 200),
  makeComp(5n, 200),
  makeComp(6n, 200),
];

// ─────────────────────────────────────────────────────────────────────────────
// Homestead cap savings_case tests (spec §5.3)
// ─────────────────────────────────────────────────────────────────────────────
describe("savings_case: clear", () => {
  it("produces positive annual_savings when implied < assessed", () => {
    // market=$500k, assessed=$400k, implied=$400k (comps at $200/sqft)
    // implied ($400k) < assessed ($400k) → NOT clear, this is boundary.
    // Use higher market value so implied < assessed.
    const subject = makeSubject({ marketValue: 600_000, assessedValue: 400_000 });
    // comps at $200/sqft → implied = $400k. assessed=$400k, implied=$400k → partial (not clear).
    // Use comps at $180/sqft → implied = $360k < assessed=$400k → clear.
    const comps = [
      makeComp(2n, 180), makeComp(3n, 180), makeComp(4n, 180),
      makeComp(5n, 180), makeComp(6n, 180),
    ];
    const { comps: selected, quality } = selectComps(subject, comps);
    const result = analyzeParcel(subject, selected, quality, RATE);

    expect(result.savingsCase).toBe("clear");
    expect(result.annualSavings).toBeGreaterThan(0);
    expect(result.impliedValue).toBeLessThan(subject.assessedValue);
  });
});

describe("savings_case: partial", () => {
  it("shows $0 annual savings but positive gross overassessment (cap protects current bill)", () => {
    // market=$600k, assessed=$400k, implied=$500k (comps at $250/sqft × 2000sqft)
    // implied ($500k) > assessed ($400k) → cap protects current taxable value → annual_savings = 0
    // implied ($500k) < market ($600k) → protest still lowers future ceiling → savings_case = 'partial'
    const subject = makeSubject({ marketValue: 600_000, assessedValue: 400_000 });
    const comps = [
      makeComp(2n, 250), makeComp(3n, 250), makeComp(4n, 250),
      makeComp(5n, 250), makeComp(6n, 250),
    ];
    const { comps: selected, quality } = selectComps(subject, comps);
    const result = analyzeParcel(subject, selected, quality, RATE);

    expect(result.savingsCase).toBe("partial");
    // Homestead cap fully protects current bill — formula gives $0 this year
    expect(result.annualSavings).toBe(0);
    // But the gross overassessment is real and shown in the packet
    expect(result.grossOverassessment).toBeGreaterThan(0);
    expect(result.impliedValue).toBeLessThan(subject.marketValue);
    expect(result.impliedValue).toBeGreaterThan(subject.assessedValue);
  });
});

describe("savings_case: capped", () => {
  it("produces ZERO annual_savings when assessed <= implied", () => {
    // market=$500k, assessed=$400k, implied=$600k (comps at $300/sqft)
    // implied ($600k) > market ($500k) → capped, no savings
    const subject = makeSubject({ marketValue: 500_000, assessedValue: 400_000 });
    const comps = [
      makeComp(2n, 300), makeComp(3n, 300), makeComp(4n, 300),
      makeComp(5n, 300), makeComp(6n, 300),
    ];
    const { comps: selected, quality } = selectComps(subject, comps);
    const result = analyzeParcel(subject, selected, quality, RATE);

    expect(result.savingsCase).toBe("capped");
    // CRITICAL INVARIANT: never show savings for capped
    expect(result.annualSavings).toBe(0);
  });

  it("produces ZERO savings when no comps available", () => {
    const subject = makeSubject();
    const result = analyzeParcel(subject, [], "strict", RATE);
    expect(result.savingsCase).toBe("capped");
    expect(result.annualSavings).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Comp selection fallback tests (spec §5.1)
// ─────────────────────────────────────────────────────────────────────────────
describe("selectComps fallbacks", () => {
  const subject = makeSubject();

  it("returns strict quality when 5+ comps match neighborhood + class + sqft ±15% + year ±10", () => {
    const { quality } = selectComps(subject, BASE_COMPS);
    expect(quality).toBe("strict");
    expect(selectComps(subject, BASE_COMPS).comps.length).toBeGreaterThanOrEqual(5);
  });

  it("falls back to relaxed_sqft when strict yields < 5", () => {
    // Comps with sqft 17% away (outside strict ±15%, inside relaxed ±20%)
    const comps = Array.from({ length: 5 }, (_, i) =>
      makeComp(BigInt(i + 2), 200, { livingSqft: 2000 * 1.17 })
    );
    const { quality } = selectComps(subject, comps);
    expect(quality).toBe("relaxed_sqft");
  });

  it("falls back to zip when neighborhood has no comps", () => {
    const comps = Array.from({ length: 5 }, (_, i) =>
      makeComp(BigInt(i + 2), 200, { neighborhoodCode: "OTHER" })
    );
    const { quality } = selectComps(subject, comps);
    expect(quality).toBe("zip");
  });

  it("excludes the subject itself from comps", () => {
    const subjectAsComp: CompCandidate = { ...subject, id: subject.id };
    const { comps } = selectComps(subject, [subjectAsComp, ...BASE_COMPS]);
    expect(comps.every((c) => c.id !== subject.id)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge case: new construction (spec §10)
// ─────────────────────────────────────────────────────────────────────────────
describe("low confidence flags", () => {
  it("flags new construction as low confidence", () => {
    const subject = makeSubject({ yearBuilt: TAX_YEAR });
    const { comps, quality } = selectComps(subject, BASE_COMPS);
    const result = analyzeParcel(subject, comps, quality, RATE);
    expect(result.lowConfidence).toBe(true);
    expect(result.lowConfidenceReason).toMatch(/new construction/i);
  });

  it("does not flag a normal parcel as low confidence", () => {
    const { comps, quality } = selectComps(makeSubject(), BASE_COMPS);
    const result = analyzeParcel(makeSubject(), comps, quality, RATE);
    expect(result.lowConfidence).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge case: missing sqft (spec §10)
// ─────────────────────────────────────────────────────────────────────────────
describe("missing sqft", () => {
  it("returns 0 comps when subject sqft is zero", () => {
    const subject = makeSubject({ livingSqft: 0 });
    // analyzeParcel with empty comps → capped, $0 savings
    const result = analyzeParcel(subject, [], "strict", RATE);
    expect(result.savingsCase).toBe("capped");
    expect(result.annualSavings).toBe(0);
  });
});
