import type { Metadata } from "next";

const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");

export const SITE_URL = configuredUrl || "https://hestia.hoangvu.id.vn";

export const site = {
  name: "Hestia",
  title: "Hestia — Evidence-based cooking and food science",
  description:
    "Explore ingredients, cooking chemistry, nutrition, and food-safety evidence with a visual AI culinary assistant.",
  locale: "en_US",
  url: SITE_URL,
};

export const indexableRoutes = [
  {
    path: "/home",
    title: "Evidence-based cooking and food science",
    description:
      "Turn ingredient photos and cooking questions into practical guidance grounded in food chemistry, safety data, and scientific evidence.",
    changeFrequency: "weekly" as const,
    priority: 1,
  },
  {
    path: "/ingredients",
    title: "Ingredient, nutrient, and food compound explorer",
    description:
      "Search dishes and ingredients, compare nutrient records, and explore food compounds from FooDB, USDA FoodData Central, and TheMealDB.",
    changeFrequency: "weekly" as const,
    priority: 0.9,
  },
  {
    path: "/science",
    title: "Cooking chemistry and food-safety science",
    description:
      "Understand browning, protein denaturation, nutrient retention, heat, pH, moisture, and food-safety pathways in practical kitchen terms.",
    changeFrequency: "monthly" as const,
    priority: 0.85,
  },
  {
    path: "/about",
    title: "About Hestia",
    description:
      "Learn how Hestia connects practical cooking guidance with transparent assumptions, scientific evidence, and visible uncertainty.",
    changeFrequency: "monthly" as const,
    priority: 0.65,
  },
  {
    path: "/download",
    title: "Hestia mobile apps",
    description:
      "See the roadmap for Hestia on Android and iPhone, or use the complete evidence-based cooking experience in your browser today.",
    changeFrequency: "monthly" as const,
    priority: 0.6,
  },
] as const;

export function absoluteUrl(path = "/") {
  const url = new URL(path, `${SITE_URL}/`);
  const lastSegment = url.pathname.split("/").filter(Boolean).at(-1) || "";
  if (url.pathname !== "/" && !url.pathname.endsWith("/") && !lastSegment.includes(".")) {
    url.pathname += "/";
  }
  return url.toString();
}

export function pageMetadata({
  path,
  title,
  description,
  keywords = [],
}: {
  path: string;
  title: string;
  description: string;
  keywords?: string[];
}): Metadata {
  const canonical = absoluteUrl(path);
  return {
    title,
    description,
    keywords,
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      siteName: site.name,
      title,
      description,
      locale: site.locale,
      images: [
        {
          url: absoluteUrl("/hestia-hero.png"),
          alt: "Hestia evidence-based culinary intelligence",
          width: 1672,
          height: 941,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [absoluteUrl("/hestia-hero.png")],
    },
  };
}

export const privatePageMetadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true, nocache: true },
};
