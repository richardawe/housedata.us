import { NextRequest, NextResponse } from "next/server";

// Path-based routing only — no subdomain rewriting needed.
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|_static|favicon\\.ico|.*\\..*).*)"],
};
