import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Travellers Club",
    short_name: "Travellers",
    description: "Membership, rewards, and facility access for Travellers Beach Resort.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#080a16",
    theme_color: "#080a16",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
