import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { getOrder } from "@/lib/db/queries";

export const runtime = "nodejs";

interface Props {
  params: Promise<{ orderId: string }>;
}

export async function GET(req: NextRequest, { params }: Props) {
  const { orderId } = await params;
  const order = await getOrder(orderId);

  if (!order || order.status !== "delivered" || !order.packet_path) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!fs.existsSync(order.packet_path)) {
    return NextResponse.json({ error: "File not available" }, { status: 404 });
  }

  const fileBuffer = fs.readFileSync(order.packet_path);
  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="protest-packet-${order.account_id}.pdf"`,
      "Content-Length": String(fileBuffer.length),
    },
  });
}
