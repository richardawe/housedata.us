import { ImageResponse } from "next/og";
import { getParcelWithAnalysis } from "@/lib/db/queries";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface Props {
  params: Promise<{ state: string; county: string; account_id: string }>;
}

export default async function OgImage({ params }: Props) {
  const { county, account_id } = await params;
  const parcel = await getParcelWithAnalysis(county, account_id);

  const headline = parcel?.pct_above != null && parcel.pct_above > 0.01
    ? `Assessed ${Math.round(parcel.pct_above * 100)}% above comparable homes`
    : "See how your assessment compares";

  const address = parcel?.situs_address ?? "Your property";
  const zip = parcel?.situs_zip ?? "";
  const savings = parcel?.annual_savings
    ? `Estimated savings: $${Math.round(parcel.annual_savings).toLocaleString()}/yr`
    : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%",
          background: "linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)",
          display: "flex", flexDirection: "column",
          justifyContent: "space-between", padding: "60px 70px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ background: "white", borderRadius: 8, padding: "6px 14px",
            color: "#1e40af", fontWeight: 700, fontSize: 18 }}>
            HouseData
          </div>
        </div>

        <div>
          <div style={{ color: "#bfdbfe", fontSize: 26, marginBottom: 16 }}>
            {address}{zip ? `, TX ${zip}` : ""}
          </div>
          <div style={{ color: "white", fontSize: 56, fontWeight: 800, lineHeight: 1.1, marginBottom: 20 }}>
            {headline}
          </div>
          {savings && (
            <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 12,
              padding: "14px 22px", color: "white", fontSize: 28, fontWeight: 600,
              display: "inline-block" }}>
              {savings}
            </div>
          )}
        </div>

        <div style={{ color: "#93c5fd", fontSize: 20 }}>
          housedata.us · Free property tax checker
        </div>
      </div>
    ),
    { ...size }
  );
}
