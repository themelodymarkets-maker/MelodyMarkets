import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Branded favicon — gradient circle with the MelodyMarkets "M" mark. */
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
          background: "linear-gradient(90deg, #a855f7, #22d3ee)",
          borderRadius: "50%",
          color: "#ffffff",
          fontSize: 18,
          fontWeight: 700,
        }}
      >
        M
      </div>
    ),
    { ...size },
  );
}
