import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hestia — Culinary intelligence",
    short_name: "Hestia",
    description:
      "Evidence-based cooking guidance, ingredient intelligence, and practical food science.",
    start_url: "/home",
    display: "standalone",
    background_color: "#fffaf6",
    theme_color: "#ff654f",
    categories: ["food", "education", "lifestyle"],
    icons: [
      {
        src: "/logo.png",
        sizes: "1600x1600",
        type: "image/png",
      },
    ],
  };
}
