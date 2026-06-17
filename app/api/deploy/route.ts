import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";

export const runtime = "nodejs";

const BUILD_DIR = "/home/housedataus/housedata-build";
const TAR_PATH  = "/home/housedataus/housedata.us/housedata-standalone.tar.gz";

// Build runs locally via scripts/deploy.sh — VPS just extracts and restarts.
const DEPLOY_CMD = [
  `tar -xzf ${TAR_PATH} -C ${BUILD_DIR}`,
  "pm2 restart housedata",
].join(" && ");

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.DEPLOY_SECRET;

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  exec(`nohup bash -lc '${DEPLOY_CMD}' >> /tmp/housedata-deploy.log 2>&1 &`);

  return NextResponse.json({ ok: true, message: "Deploy started — tail /tmp/housedata-deploy.log" });
}
