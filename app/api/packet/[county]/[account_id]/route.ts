import { NextRequest, NextResponse } from "next/server";
import { getParcelWithAnalysis, getCompRows, getCounty } from "@/lib/db/queries";
import { generatePacketBytes } from "@/lib/pdf/packet-generator";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

interface Props {
  params: Promise<{ county: string; account_id: string }>;
}

export async function POST(req: NextRequest, { params }: Props) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!rateLimit(ip, 5, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { county, account_id } = await params;
  const { ownerName = "" } = await req.json().catch(() => ({}));

  const parcel = await getParcelWithAnalysis(county, account_id);
  if (!parcel) return NextResponse.json({ error: "Parcel not found" }, { status: 404 });

  const comps = parcel.comp_ids ? await getCompRows(parcel.comp_ids.map(String)) : [];
  const countyData = await getCounty(county);

  const pdfBytes = await generatePacketBytes({
    parcel,
    comps,
    ownerName: ownerName.trim(),
    countyName: countyData?.name ?? "Travis County",
    protestDeadline: countyData?.protest_deadline_rule ?? "May 15 or 30 days after notice",
    efileUrl: countyData?.arb_filing_url ?? "https://traviscad.org/efile/",
  });

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="protest-packet-${account_id}.pdf"`,
      "Content-Length": String(pdfBytes.length),
    },
  });
}
