import { NextRequest, NextResponse } from "next/server";
import { getOrderBySession } from "@/lib/db/queries";

export async function GET(req: NextRequest) {
  const session = req.nextUrl.searchParams.get("session") ?? "";
  if (!session) return NextResponse.json({ error: "session required" }, { status: 400 });
  const order = await getOrderBySession(session);
  if (!order) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ orderId: order.id });
}
