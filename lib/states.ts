export const STATE_SUBDOMAINS: Record<string, string> = {
  TX: "texas",
  CA: "california",
  FL: "florida",
  NY: "new-york",
  IL: "illinois",
  PA: "pennsylvania",
  OH: "ohio",
  GA: "georgia",
  NC: "north-carolina",
  AZ: "arizona",
};

export const SUBDOMAIN_STATES: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_SUBDOMAINS).map(([k, v]) => [v, k])
);

// "travis-tx" → "texas"
export function slugToSubdomain(countySlug: string): string {
  const stateCode = countySlug.split("-").pop()?.toUpperCase() ?? "";
  return STATE_SUBDOMAINS[stateCode] ?? stateCode.toLowerCase();
}

// "texas" → "TX"
export function subdomainToStateCode(subdomain: string): string {
  return (
    SUBDOMAIN_STATES[subdomain]?.toUpperCase() ??
    subdomain.toUpperCase().slice(0, 2)
  );
}

// Build the base URL for a state subdomain
// In dev (localhost), returns the path prefix instead
export function stateBaseUrl(
  subdomain: string,
  appBaseUrl: string
): string {
  if (appBaseUrl.includes("localhost")) return appBaseUrl;
  return `https://${subdomain}.${new URL(appBaseUrl).hostname}`;
}
