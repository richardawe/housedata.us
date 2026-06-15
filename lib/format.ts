export const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export const pct = (n: number, digits = 1) => `${(n * 100).toFixed(digits)}%`;

export const num = (n: number) => new Intl.NumberFormat("en-US").format(Math.round(n));
