import { ImageResponse } from "next/og";
export const runtime = "edge";
export const alt = "Travellers Club";
export async function GET() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#f6f8fa",
        color: "#173b54",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 72,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", width: 520 }}>
        <div style={{ fontSize: 22, letterSpacing: 5 }}>TRAVELLERS CLUB</div>
        <div style={{ fontSize: 60, lineHeight: 1.1, marginTop: 30 }}>
          Your membership, always with you.
        </div>
        <div style={{ fontSize: 24, color: "#5a6670", marginTop: 28 }}>
          Rewards, gym & resort access at Travellers Beach Resort.
        </div>
      </div>
      <div
        style={{
          width: 420,
          height: 270,
          borderRadius: 22,
          padding: 32,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(125deg,#1d4058,#152b3b)",
          color: "#ffffff",
        }}
      >
        <div style={{ fontSize: 20, letterSpacing: 3 }}>TRAVELLERS CLUB</div>
        <div style={{ fontSize: 30 }}>A little more, every visit.</div>
        <div style={{ fontSize: 16, color: "#d4dfe7" }}>
          Digital membership · Hotel benefits
        </div>
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
