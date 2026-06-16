import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  const iconData = readFileSync(join(process.cwd(), "public/icon-512.png"));
  const iconSrc = `data:image/png;base64,${iconData.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          background: "white",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Icon */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 360,
            height: "100%",
            flexShrink: 0,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={iconSrc} width={280} height={280} alt="" />
        </div>

        {/* Divider */}
        <div style={{ width: 2, height: 380, background: "#e2e8f0", flexShrink: 0 }} />

        {/* Text */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "0 64px",
            flex: 1,
          }}
        >
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: "#2563eb",
              letterSpacing: 3,
              textTransform: "uppercase",
              marginBottom: 20,
            }}
          >
            housedata.us
          </div>
          <div
            style={{
              fontSize: 52,
              fontWeight: 800,
              color: "#0f172a",
              lineHeight: 1.1,
              marginBottom: 24,
            }}
          >
            Is your home over-assessed?
          </div>
          <div style={{ fontSize: 26, color: "#475569", lineHeight: 1.5 }}>
            Free instant property tax check — backed by public appraisal data.
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
