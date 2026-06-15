// Simple in-process rate limiter: max `limit` requests per `windowMs` per IP.
// Resets when the process restarts — acceptable for a single-process cPanel deployment.

const store = new Map<string, { count: number; reset: number }>();

export function rateLimit(ip: string, limit = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = store.get(ip);
  if (!entry || now > entry.reset) {
    store.set(ip, { count: 1, reset: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}
