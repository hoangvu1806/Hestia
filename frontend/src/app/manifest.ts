import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hestia — Culinary Intelligence & Food Science",
    short_name: "Hestia",
    description:
      "Evidence-based cooking guidance, food chemistry explanations, nutrient retention calculations, and food-safety screening.",
    start_url: "/home/",
    display: "standalone",
    background_color: "#fffaf6",
    theme_color: "#ff654f",
    categories: ["food", "education", "lifestyle", "productivity"],
    lang: "en",
    dir: "ltr",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/logo.png",
        sizes: "1600x1600",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/logo-transparent.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Ask Hestia",
        short_name: "Chat",
        description: "Open the culinary AI assistant",
        url: "/chat/",
        icons: [{ src: "/logo.png", sizes: "192x192" }],
      },
      {
        name: "Food Library",
        short_name: "Ingredients",
        description: "Explore food compounds and nutrient data",
        url: "/ingredients/",
        icons: [{ src: "/logo.png", sizes: "192x192" }],
      },
      {
        name: "Food Science",
        short_name: "Science",
        description: "Learn cooking chemistry and food-safety mechanisms",
        url: "/science/",
        icons: [{ src: "/logo.png", sizes: "192x192" }],
      },
    ],
  };
}
