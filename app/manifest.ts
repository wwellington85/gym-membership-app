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
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
