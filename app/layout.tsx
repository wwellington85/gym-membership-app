import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://127.0.0.1:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Travellers Club",
  description: "Membership, rewards, and facility access for Travellers Beach Resort.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className="min-h-screen oura-bg text-[rgb(var(--fg))]">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <div className="mx-auto w-full max-w-md px-4 py-6">
            <div className="oura-shell p-4 text-[rgb(var(--fg))]">{children}</div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
