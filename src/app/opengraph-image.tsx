import { ImageResponse } from "next/og";

export const alt = "Adhira Flowers: flowers, gifts and plant setups across the UAE";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Default social-share card (WhatsApp, LinkedIn, Facebook previews).
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "#0e1512",
          color: "#ffffff",
        }}
      >
        <div style={{ fontSize: 26, letterSpacing: 6, color: "#6ee7b7", display: "flex" }}>
          ADHIRA FLOWERS · UAE
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 88, fontFamily: "Georgia, serif", lineHeight: 1.05, display: "flex" }}>
            Flowers and plants, beautifully considered.
          </div>
          <div style={{ fontSize: 30, color: "#b7c4bd", display: "flex" }}>
            Offices · Events · Weddings · Plant rental
          </div>
        </div>
      </div>
    ),
    size,
  );
}
