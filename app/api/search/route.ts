import { NextRequest, NextResponse } from "next/server";
import { searchAddresses } from "@/lib/db/queries";
import { LAUNCH_COUNTY } from "@/lib/config";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!rateLimit(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) return NextResponse.json([]);

  try {
    const county = req.nextUrl.searchParams.get("county")?.trim() || LAUNCH_COUNTY;
  const results = await searchAddresses(q.toUpperCase(), county, 5);
    return NextResponse.json(results);
  } catch {
    return NextResponse.json({ error: "Search unavailable" }, { status: 503 });
  }
}
