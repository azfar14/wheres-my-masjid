import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Where’s My Masjid",
    short_name: "My Masjid",
    description: "Find nearby masjids, Qibla direction, jamaat timings, saved masjids, verified updates, and claim tools for masjid teams.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f1e8",
    theme_color: "#0f3d2e",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml"
      }
    ]
  };
}
