import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getDb } from "@/lib/db/client";
import { getServerConfig } from "@/lib/config";
import { slugToSubdomain } from "@/lib/states";

export async function POST(req: NextRequest) {
  try {
  const { parcelId } = await req.json();
  if (!parcelId) return NextResponse.json({ error: "parcelId required" }, { status: 400 });

  const config = getServerConfig();
  const stripe = new Stripe(config.STRIPE_SECRET_KEY);

  // Verify parcel exists
  const sql = getDb();
  type R = Record<string, string>;
  const rows = (await sql`
    SELECT p.id, p.account_id, p.situs_address, c.slug AS county_slug
    FROM parcels p JOIN counties c ON c.id = p.county_id
    WHERE p.id = ${parcelId} LIMIT 1
  `) as unknown as R[];
  if (!rows[0]) return NextResponse.json({ error: "Parcel not found" }, { status: 404 });
  const parcel = rows[0];

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    line_items: [{ price: config.STRIPE_PRICE_ID, quantity: 1 }],
    customer_creation: "always",
    custom_fields: [
      {
        key: "owner_name",
        label: { type: "custom", custom: "Property owner name (for Form 50-132)" },
        type: "text",
      },
    ],
    metadata: { parcel_id: String(parcel.id), address: parcel.situs_address },
    success_url: `${config.NEXT_PUBLIC_BASE_URL}/order/{CHECKOUT_SESSION_ID}`,
    cancel_url: (() => {
      const base = config.NEXT_PUBLIC_BASE_URL;
      if (base.includes("localhost")) {
        const subdomain = slugToSubdomain(parcel.county_slug);
        return `${base}/${subdomain}/${parcel.county_slug}/${parcel.account_id}`;
      }
      const subdomain = slugToSubdomain(parcel.county_slug);
      const host = new URL(base).hostname;
      return `https://${subdomain}.${host}/${parcel.county_slug}/${parcel.account_id}`;
    })(),
  });

  return NextResponse.json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[checkout]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
