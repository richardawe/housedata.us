import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";

export const runtime = "nodejs";

const BUILD_DIR = "/home/housedataus/housedata-build";

// Build WITHOUT deleting .next first — Next.js does a full rebuild on its own
// and npm ci gives us clean node_modules. Keeping the old .next means the
// running server stays healthy if the new build fails partway through.
//
// server.js uses dir=<project-root> so Next.js serves .next/static/ and public/
// directly from the build dir. We also copy into .next/standalone/ as a safety
// net in case PM2 is configured to use the generated standalone server.
const DEPLOY_CMD = [
  `cd ${BUILD_DIR}`,
  "git pull origin main",
  "npm ci",
  "NODE_OPTIONS=--max_old_space_size=1024 NEXT_PUBLIC_BASE_URL=https://housedata.us npm run build",
  "cp server.js .next/standalone/server.js",
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

  // flock serializes concurrent deploys — if a build is already running the next
  // invocation waits for it to finish rather than spawning a second npm ci/build
  // (which would OOM the server). Login shell (-lc) ensures nvm/npm are on PATH.
  exec(`nohup flock /tmp/housedata-deploy.lock bash -lc '${DEPLOY_CMD}' >> /tmp/housedata-deploy.log 2>&1 &`);

  return NextResponse.json({ ok: true, message: "Deploy started — tail /tmp/housedata-deploy.log" });
}
