import { NextRequest, NextResponse } from "next/server";

const ROOT_HOSTS = ["housedata.us", "www.housedata.us"];

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";

  // Dev (localhost) or root domain — no rewrite
  if (host.includes("localhost") || ROOT_HOSTS.some((h) => host === h)) {
    return NextResponse.next();
  }

  const subdomain = host.split(".")[0]; // "texas" from "texas.housedata.us"
  const url = req.nextUrl.clone();

  // Already prefixed with the state — pass through to avoid double-rewrite
  if (
    url.pathname === `/${subdomain}` ||
    url.pathname.startsWith(`/${subdomain}/`)
  ) {
    return NextResponse.next();
  }

  // Prepend state to path
  url.pathname = `/${subdomain}${url.pathname === "/" ? "" : url.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Run on all paths except API routes, Next internals, and static files
  matcher: ["/((?!api|_next|_static|favicon\\.ico|.*\\..*).*)"],
};
