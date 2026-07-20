import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * Branded favicon: the MelodyMarkets "M" on electric cyan.
 * Literal token hex because ImageResponse renders outside the app.
 */
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
          background: "#00F2FE",
          borderRadius: 999,
          color: "#0B111E",
          fontSize: 20,
          fontWeight: 600,
        }}
      >
        M
      </div>
    ),
    { ...size },
  );
}
