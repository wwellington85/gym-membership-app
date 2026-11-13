import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Travellers Club",
    short_name: "Travellers Club",
    description:
      "Membership, rewards, and facility access for Travellers Beach Resort.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      {
        src: "/icons/icon-192.png?v=club-gold-tc-1",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png?v=club-gold-tc-1",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-maskable-512.png?v=club-gold-tc-1",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
