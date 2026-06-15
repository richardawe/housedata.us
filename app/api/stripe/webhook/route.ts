import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import path from "path";
import { getServerConfig } from "@/lib/config";
import { getDb } from "@/lib/db/client";
import { getParcelWithAnalysis, getCompRows, createOrder, markOrderDelivered, getOrderBySession } from "@/lib/db/queries";
import { generatePacket } from "@/lib/pdf/packet-generator";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const config = getServerConfig();
  const stripe = new Stripe(config.STRIPE_SECRET_KEY);

  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, config.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ ok: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const parcelId = session.metadata?.parcel_id;
  const email = session.customer_details?.email ?? "";
  const ownerName =
    (session.custom_fields?.find((f) => f.key === "owner_name")?.text?.value ?? "").trim();

  if (!parcelId || !email) {
    return NextResponse.json({ error: "Missing parcel_id or email" }, { status: 400 });
  }

  // Idempotency: skip if already processed
  const existing = await getOrderBySession(session.id);
  if (existing?.status === "delivered") return NextResponse.json({ ok: true });

  // Create order (INSERT ... ON CONFLICT DO NOTHING handles race conditions)
  const order = await createOrder({
    parcelId,
    email,
    ownerName,
    stripeSessionId: session.id,
  });
  if (!order) return NextResponse.json({ ok: true }); // already existed

  try {
    // Fetch parcel + analysis + comps
    const sql = getDb();
    type R = Record<string, string>;
    const countyRows = (await sql`
      SELECT c.slug FROM parcels p JOIN counties c ON c.id = p.county_id WHERE p.id = ${parcelId} LIMIT 1
    `) as unknown as R[];
    const countySlug = countyRows[0]?.slug ?? "";
    const accountRows = (await sql`SELECT account_id FROM parcels WHERE id = ${parcelId} LIMIT 1`) as unknown as R[];
    const accountId = accountRows[0]?.account_id ?? "";

    const parcel = await getParcelWithAnalysis(countySlug, accountId);
    if (!parcel) throw new Error(`Parcel not found: ${parcelId}`);

    const comps = parcel.comp_ids ? await getCompRows(parcel.comp_ids.map(String)) : [];

    // County info for the packet
    const countyRow = (await sql`
      SELECT name, protest_deadline_rule, arb_filing_url FROM counties WHERE slug = ${countySlug} LIMIT 1
    `) as unknown as R[];
    const county = countyRow[0];

    // Generate PDF
    const outputPath = path.join(config.PACKET_STORAGE_PATH, `${order.id}.pdf`);
    await generatePacket({
      parcel,
      comps,
      ownerName: ownerName || email,
      countyName: county?.name ?? "Travis County",
      protestDeadline: county?.protest_deadline_rule ?? "May 15 or 30 days after notice",
      efileUrl: county?.arb_filing_url ?? "https://traviscad.org/efile/",
      outputPath,
    });

    await markOrderDelivered(order.id, outputPath);
  } catch (err) {
    console.error("Packet generation failed:", err);
    // Don't return 500 — Stripe would retry. Log and let the order stay in 'paid' state
    // for manual recovery.
  }

  return NextResponse.json({ ok: true });
}
