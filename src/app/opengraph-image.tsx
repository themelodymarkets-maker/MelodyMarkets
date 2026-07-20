import { ImageResponse } from "next/og";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site-metadata";

export const alt = `${SITE_NAME}: trade virtual shares of music artists`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Default Open Graph image for link previews. Literal token hex because
 * ImageResponse renders outside the app and cannot use CSS variables.
 */
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
          background: "#0B111E",
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
            background: "#00F2FE",
            borderRadius: 999,
            color: "#0B111E",
            fontSize: 56,
            fontWeight: 600,
            marginBottom: 32,
          }}
        >
          M
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 600,
            color: "#FFFFFF",
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          {SITE_NAME}
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 28,
            color: "#8B9BB4",
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
