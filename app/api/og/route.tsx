import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Travellers Club";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          position: "relative",
          background:
            "radial-gradient(circle at 22% 18%, rgba(110,104,215,0.32), transparent 28%), radial-gradient(circle at 82% 22%, rgba(10,120,95,0.18), transparent 30%), linear-gradient(135deg, #090b14 0%, #11152a 40%, #1a1740 72%, #120d24 100%)",
          color: "#f6f1df",
          overflow: "hidden",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 26,
            borderRadius: 36,
            border: "1px solid rgba(220, 198, 132, 0.28)",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015))",
          }}
        />

        <div
          style={{
            position: "absolute",
            left: 76,
            top: 74,
            width: 420,
            height: 420,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 50% 50%, rgba(14, 92, 73, 0.34), transparent 64%)",
            filter: "blur(12px)",
          }}
        />

        <div
          style={{
            position: "absolute",
            right: 96,
            top: 88,
            width: 360,
            height: 420,
            borderRadius: 34,
            border: "1px solid rgba(220, 198, 132, 0.24)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))",
            boxShadow:
              "0 22px 60px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.035)",
            transform: "rotate(-4deg)",
          }}
        />

        <div
          style={{
            position: "absolute",
            right: 130,
            top: 120,
            width: 360,
            height: 420,
            borderRadius: 34,
            border: "1px solid rgba(255,255,255,0.08)",
            background:
              "radial-gradient(circle at 25% 18%, rgba(255,255,255,0.1), transparent 24%), linear-gradient(160deg, rgba(26,29,58,0.92), rgba(8,10,20,0.94))",
            boxShadow:
              "0 28px 72px rgba(0,0,0,0.42), inset 0 0 0 1px rgba(255,255,255,0.04)",
            display: "flex",
            flexDirection: "column",
            padding: "34px 34px 28px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginBottom: 28,
            }}
          >
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: 18,
                background:
                  "linear-gradient(135deg, rgba(213,190,122,0.25), rgba(255,255,255,0.05))",
                border: "1px solid rgba(222, 200, 137, 0.34)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#e9d299",
                fontSize: 30,
                fontWeight: 700,
                fontStyle: "italic",
              }}
            >
              T
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 3,
              }}
            >
              <div
                style={{
                  fontSize: 15,
                  letterSpacing: 4,
                  color: "rgba(246,241,223,0.72)",
                }}
              >
                TRAVELLERS CLUB
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: "rgba(233,210,153,0.88)",
                }}
              >
                Travellers Beach Resort
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 18,
              marginTop: 18,
            }}
          >
            <div
              style={{
                fontSize: 38,
                fontWeight: 700,
                lineHeight: 1.08,
                color: "#fffaf0",
              }}
            >
              Membership, rewards,
              <br />
              and resort access
            </div>
            <div
              style={{
                fontSize: 18,
                lineHeight: 1.45,
                color: "rgba(246,241,223,0.78)",
                maxWidth: 280,
              }}
            >
              Gym check-ins, member benefits, front desk operations, and club access in one place.
            </div>
          </div>

          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              style={{
                width: 118,
                height: 2,
                background: "linear-gradient(90deg, #d6bf7d, rgba(214,191,125,0))",
              }}
            />
            <div style={{ fontSize: 20, color: "#e9d299" }}>club.tbr.travel</div>
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            left: 96,
            top: 116,
            display: "flex",
            flexDirection: "column",
            gap: 22,
            maxWidth: 500,
          }}
        >
          <div
            style={{
              fontSize: 21,
              letterSpacing: 6,
              color: "rgba(233,210,153,0.82)",
            }}
          >
            TRAVELLERS CLUB
          </div>
          <div
            style={{
              fontSize: 72,
              lineHeight: 0.98,
              fontWeight: 700,
              color: "#fffaf0",
            }}
          >
            Premium access,
            <br />
            modern member ops
          </div>
          <div
            style={{
              fontSize: 28,
              lineHeight: 1.35,
              color: "rgba(246,241,223,0.8)",
              maxWidth: 460,
            }}
          >
            Built for Travellers Beach Resort with a cleaner, more boutique club presence across every shared link.
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            left: 98,
            bottom: 92,
            display: "flex",
            gap: 18,
          }}
        >
          {["Member Benefits", "Check-ins", "Resort Access"].map((label) => (
            <div
              key={label}
              style={{
                padding: "12px 18px",
                borderRadius: 999,
                border: "1px solid rgba(220,198,132,0.28)",
                background: "rgba(255,255,255,0.04)",
                fontSize: 18,
                color: "rgba(246,241,223,0.9)",
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
