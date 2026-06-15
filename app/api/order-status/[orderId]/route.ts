import { NextRequest, NextResponse } from "next/server";
import { getOrder } from "@/lib/db/queries";

interface Props {
  params: Promise<{ orderId: string }>;
}

export async function GET(_req: NextRequest, { params }: Props) {
  const { orderId } = await params;
  const order = await getOrder(orderId);
  if (!order) return NextResponse.json({ status: "error" }, { status: 404 });
  return NextResponse.json({
    status: order.status,
    address: order.situs_address ?? null,
    accountId: order.account_id ?? null,
  });
}
