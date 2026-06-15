import { NextRequest, NextResponse } from "next/server";

// This route exists solely to trigger the browser's Basic Auth dialog.
// The actual admin UI is at /admin/orders (server component with auth check).
export async function GET(_req: NextRequest) {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="HouseData Admin"' },
  });
}
