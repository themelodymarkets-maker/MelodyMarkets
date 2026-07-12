import { ImageResponse } from "next/og";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site-metadata";

export const alt = `${SITE_NAME} — trade virtual shares of music artists`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Default Open Graph image for link previews. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#05050a",
          padding: 64,
        }}
      >
        <div
          style={{
            width: 96,
            height: 96,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(90deg, #a855f7, #22d3ee)",
            borderRadius: "50%",
            color: "#ffffff",
            fontSize: 48,
            fontWeight: 700,
            marginBottom: 32,
          }}
        >
          M
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: "#f5f5f7",
            letterSpacing: -1,
          }}
        >
          {SITE_NAME}
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 28,
            color: "#9a9aac",
            textAlign: "center",
            maxWidth: 900,
            lineHeight: 1.4,
          }}
        >
          {SITE_DESCRIPTION}
        </div>
      </div>
    ),
    { ...size },
  );
}
