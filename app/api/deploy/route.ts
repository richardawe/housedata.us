import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";

export const runtime = "nodejs";

const BUILD_DIR = "/home/housedataus/housedata-build";

const DEPLOY_CMD = [
  `cd ${BUILD_DIR}`,
  "git pull origin main",
  "npm install",
  "NEXT_PUBLIC_BASE_URL=https://housedata.us npm run build",
  "cp -r .next/static .next/standalone/.next/static",
  "cp -r public .next/standalone/public",
  "pm2 restart housedata",
].join(" && ");

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.DEPLOY_SECRET;

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Run in background via login shell so nvm/npm PATH is available.
  // nohup + & detaches from the current process so the PM2 restart at
  // the end of DEPLOY_CMD doesn't kill this in-flight response.
  exec(`nohup bash -lc '${DEPLOY_CMD}' >> /tmp/housedata-deploy.log 2>&1 &`);

  return NextResponse.json({ ok: true, message: "Deploy started — tail /tmp/housedata-deploy.log" });
}
