import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Archivo, Poppins } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/pwa/sw-register";
const archivo = Archivo({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sans" });


const poppins = Poppins({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: "--font-bubble" });
const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://127.0.0.1:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Travellers Club",
  description: "Membership, rewards, and facility access for Travellers Beach Resort.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Travellers Club",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${archivo.variable} ${poppins.variable}`}>
      <body suppressHydrationWarning className="min-h-svh oura-bg text-[rgb(var(--fg))] overflow-hidden font-sans">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <ServiceWorkerRegister />
          {children}
          <div id="app-portal" />
        </ThemeProvider>
      </body>
    </html>
  );
}
