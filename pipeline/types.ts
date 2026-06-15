export interface NormalizedParcel {
  accountId: string;
  situsAddress: string;
  situsCity: string | null;
  situsZip: string | null;
  neighborhoodCode: string | null;
  stateClass: string | null;
  marketValue: number | null;
  assessedValue: number | null;
  landValue: number | null;
  improvementValue: number | null;
  livingSqft: number | null;
  yearBuilt: number | null;
  qualityClass: string | null;
  exemptions: string[];
  lat: number | null;
  lng: number | null;
}

export interface CountyConfig {
  slug: string;
  name: string;
  state: string;
  // URL or local path to the appraisal roll ZIP/CSV.
  // Navigate to traviscad.org/publicinformation/, download the
  // "Preliminary Appraisal Roll Export" ZIP, and set this to the local path.
  rollPath: string;
  protestDeadlineRule: string;
  arbFilingUrl: string;
  // Taxing jurisdictions whose rates sum to the combined property tax rate.
  // Rates are per $100 of taxable value, as published by the tax assessor.
  jurisdictions: Array<{ name: string; rate: number }>;
  taxYear: number;
  // Standard CSV path: called once per raw CSV row.
  parseRow?: (row: Record<string, string>) => NormalizedParcel | null;
  // Fixed-width multi-file override: county supplies its own loader.
  // If present, loader.ts calls this instead of CSV streaming + parseRow.
  loadParcels?: () => Promise<NormalizedParcel[]>;
}
