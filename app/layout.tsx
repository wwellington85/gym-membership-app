import { Suspense } from "react";
import { ClubLaunch } from "@/components/pwa/club-launch";
import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Archivo } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/pwa/sw-register";
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
});

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://127.0.0.1:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Travellers Club",
  description:
    "Membership, rewards, and facility access for Travellers Beach Resort.",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Travellers Club",
    description:
      "Membership, rewards, and facility access for Travellers Beach Resort.",
    images: ["/api/og"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Travellers Club",
    description:
      "Membership, rewards, and facility access for Travellers Beach Resort.",
    images: ["/api/og"],
  },
  icons: {
    icon: [
      {
        url: "/icons/icon-192.png?v=club-gold-tc-1",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icons/icon-512.png?v=club-gold-tc-1",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png?v=club-gold-tc-1",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Travellers Club",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={archivo.variable}>
      <body
        suppressHydrationWarning
        className="min-h-svh oura-bg text-[rgb(var(--fg))] overflow-hidden font-sans"
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          forcedTheme="light"
          enableSystem={false}
        >
          <a href="#main-content" className="skip-link">
            Skip to content
          </a>
          <ServiceWorkerRegister />
          <ClubLaunch />
          <Suspense fallback={null}>{children}</Suspense>
          <div id="app-portal" />
        </ThemeProvider>
      </body>
    </html>
  );
}
