import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

// Favicon: brand-green tile with a monogram. Generated, so there is no binary
// asset to keep in sync with the brand colour.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0e7c5a",
          color: "#ffffff",
          fontSize: 38,
          fontWeight: 700,
          fontFamily: "Georgia, serif",
          borderRadius: 14,
        }}
      >
        FP
      </div>
    ),
    size,
  );
}
