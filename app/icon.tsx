import { ImageResponse } from "next/og";
import resumeData from "@/data/resume-data.json";

/**
 * Dynamic favicon — circular Kanagawa-tinted orb with initials.
 *
 * Mirrors the navbar `<Monogram>` look at favicon scale. Satori (the engine
 * behind `ImageResponse`) doesn't support backdrop-filter or conic gradients,
 * so the three Kanagawa hues are approximated with a linear-gradient blend
 * plus a soft top-left radial highlight for the bubble cue.
 */

export const runtime = "edge";
export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function Icon() {
  const initials = getInitials(resumeData.personal.name);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // Kanagawa hues blended: sakuraPink → waveAqua2 → crystalBlue.
        background: "linear-gradient(135deg, #d27e99 0%, #7aa89f 55%, #7e9cd8 100%)",
        borderRadius: "50%",
        // Top-left highlight = bubble cue. Bottom-right shadow = depth.
        boxShadow: "inset 1px 1px 0 rgba(255,255,255,0.45), inset -1px -1px 0 rgba(20,22,30,0.25)",
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: "0.04em",
          color: "rgba(20, 22, 30, 0.92)",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {initials}
      </div>
    </div>,
    {
      ...size,
    },
  );
}
