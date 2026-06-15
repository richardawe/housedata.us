import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.DEPLOY_SECRET;

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  exec("pm2 restart housedata --update-env", (err) => {
    if (err) console.error("[deploy] pm2 restart failed:", err.message);
  });

  return NextResponse.json({ ok: true, message: "Restarting..." });
}
