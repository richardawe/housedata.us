import { headers } from "next/headers";

export async function requireAdmin(): Promise<boolean> {
  const hdrs = await headers();
  const auth = hdrs.get("authorization") ?? "";
  if (!auth.startsWith("Basic ")) return false;
  const decoded = Buffer.from(auth.slice(6), "base64").toString("utf-8");
  const [, password] = decoded.split(":", 2);
  return password === process.env.ADMIN_PASSWORD;
}
