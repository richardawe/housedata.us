import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { getDb } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export default async function AdminOrders() {
  const ok = await requireAdmin();
  if (!ok) {
    // Trigger browser Basic Auth dialog by returning 401 with WWW-Authenticate.
    // Next.js doesn't support returning 401 from a page directly, so we use
    // a route handler instead — see /api/admin/orders for the actual data.
    redirect("/api/admin/orders");
  }

  const sql = getDb();
  type OrderRow = { id: string; email: string; owner_name: string; status: string; created_at: string; situs_address: string; account_id: string };
  const orders = (await sql`
    SELECT
      o.id, o.email, o.owner_name, o.status, o.created_at, o.delivered_at,
      p.situs_address, p.account_id, c.slug AS county_slug
    FROM orders o
    JOIN parcels p ON p.id = o.parcel_id
    JOIN counties c ON c.id = p.county_id
    ORDER BY o.created_at DESC
    LIMIT 200
  `) as unknown as OrderRow[];

  return (
    <main className="p-8 font-mono text-sm">
      <h1 className="text-2xl font-bold mb-6">Orders ({orders.length})</h1>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-gray-100">
            {["Created", "Email", "Address", "Status", "Download"].map((h) => (
              <th key={h} className="text-left px-3 py-2 border">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={String(o.id)} className="border-b hover:bg-gray-50">
              <td className="px-3 py-2 border">{new Date(o.created_at).toLocaleDateString()}</td>
              <td className="px-3 py-2 border">{o.email}</td>
              <td className="px-3 py-2 border">{o.situs_address}</td>
              <td className="px-3 py-2 border">
                <span className={`px-2 py-0.5 rounded text-xs ${
                  o.status === "delivered" ? "bg-green-100 text-green-800" :
                  o.status === "paid" ? "bg-yellow-100 text-yellow-800" :
                  o.status === "refunded" ? "bg-red-100 text-red-800" :
                  "bg-gray-100 text-gray-600"
                }`}>
                  {o.status}
                </span>
              </td>
              <td className="px-3 py-2 border">
                {o.status === "delivered" && (
                  <a href={`/api/download/${o.id}`} className="text-blue-600 hover:underline">
                    PDF
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
