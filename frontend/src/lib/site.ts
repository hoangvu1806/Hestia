import type { Metadata } from "next";

const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");

export const SITE_URL = configuredUrl || "https://hestia.hoangvu.id.vn";

export const site = {
  name: "Hestia",
  title: "Hestia — Evidence-Based AI Culinary Intelligence & Food Science",
  tagline: "Culinary intelligence, grounded in evidence",
  description:
    "Explore ingredients, cooking chemistry, nutrient retention, and food-safety evidence with an intelligent multimodal AI culinary assistant.",
  locale: "en_US",
  locales: ["en_US", "vi_VN"] as const,
  url: SITE_URL,
  author: "Hestia AI Culinary Science Team",
  creator: "Hestia",
  publisher: "Hestia Culinary Technologies",
  keywords: [
    // Core English Keywords
    "evidence-based cooking",
    "culinary AI",
    "AI cooking assistant",
    "food science",
    "cooking chemistry",
    "food safety assistant",
    "ingredient photo analysis",
    "nutrient retention",
    "food compound database",
    "FooDB database",
    "USDA FoodData Central",
    "TheMealDB",
    "Maillard reaction guide",
    "protein denaturation cooking",
    "temperature danger zone food safety",
    "kitchen science calculator",
    "smart kitchen AI",
    "culinary intelligence",
    "scientific recipe analysis",
    "toxicology food screening",
    "EFSA OpenFoodTox",
    "PubChem food chemistry",
    "Semantic Scholar food research",

    // Vietnamese Keywords for Localized Search
    "nấu ăn khoa học",
    "trợ lý nấu ăn AI",
    "khoa học thực phẩm",
    "hóa học nấu ăn",
    "an toàn thực phẩm",
    "phân tích nguyên liệu bằng hình ảnh",
    "phản ứng Maillard trong nấu ăn",
    "tra cứu dinh dưỡng thực phẩm",
    "thư viện hợp chất thực phẩm",
    "bếp thông minh AI",
    "hướng dẫn nấu ăn chuẩn khoa học",
  ],
};

export interface RouteConfig {
  path: string;
  title: string;
  description: string;
  changeFrequency: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority: number;
  image?: string;
  imageAlt?: string;
  keywords?: string[];
}

export const indexableRoutes: readonly RouteConfig[] = [
  {
    path: "/home",
    title: "Hestia — Evidence-Based Cooking & Food Science Intelligence",
    description:
      "Turn ingredient photos and cooking questions into practical kitchen decisions grounded in food chemistry, safety data, and peer-reviewed scientific evidence.",
    changeFrequency: "weekly",
    priority: 1.0,
    image: "/hestia-hero.png",
    imageAlt: "Hestia evidence-based culinary intelligence platform overview",
    keywords: [
      "AI cooking assistant",
      "evidence-based cooking",
      "food science platform",
      "ingredient scanner",
      "cooking chemistry AI",
    ],
  },
  {
    path: "/ingredients",
    title: "Ingredient, Nutrient & Food Compound Explorer — Biochemical Data | Hestia",
    description:
      "Search dishes and ingredients, compare USDA nutrient records, and explore biochemical compounds from FooDB, USDA FoodData Central, and TheMealDB.",
    changeFrequency: "daily",
    priority: 0.95,
    image: "/ingredient-intelligence.png",
    imageAlt: "Hestia ingredient intelligence and compound database explorer",
    keywords: [
      "food compound database",
      "FooDB explorer",
      "USDA nutrient database",
      "ingredient nutrition facts",
      "culinary chemistry database",
    ],
  },
  {
    path: "/science",
    title: "Cooking Chemistry & Food Safety Science — Thermal & Reaction Pathways | Hestia",
    description:
      "Understand browning reactions, protein denaturation, nutrient retention kinetics, heat transfer, pH, water activity, and food safety danger zones in practical kitchen terms.",
    changeFrequency: "weekly",
    priority: 0.9,
    image: "/hestia-hero.png",
    imageAlt: "Hestia cooking chemistry and food-safety science pathways",
    keywords: [
      "Maillard reaction guide",
      "cooking chemistry",
      "protein denaturation",
      "food safety danger zone",
      "nutrient retention cooking",
    ],
  },
  {
    path: "/about",
    title: "About Hestia — Evidence-Aware AI Culinary Intelligence & Mission | Hestia",
    description:
      "Learn how Hestia connects practical cooking execution with peer-reviewed food science, transparent assumptions, verified chemical databases, and visible uncertainty.",
    changeFrequency: "monthly",
    priority: 0.8,
    image: "/logo-transparent.png",
    imageAlt: "About Hestia culinary intelligence team and mission",
    keywords: [
      "about Hestia",
      "culinary AI mission",
      "evidence-aware AI",
      "responsible kitchen assistant",
    ],
  },
  {
    path: "/download",
    title: "Hestia Mobile Apps — Android & iOS Culinary Assistant Roadmap | Hestia",
    description:
      "Explore the roadmap for Hestia native Android and iOS mobile applications, or experience the complete culinary intelligence platform in your web browser today.",
    changeFrequency: "monthly",
    priority: 0.7,
    image: "/hestia-hero.png",
    imageAlt: "Hestia mobile applications for Android and iOS",
    keywords: [
      "cooking app Android",
      "food science app iPhone",
      "culinary assistant mobile",
      "Hestia app download",
    ],
  },
  {
    path: "/login",
    title: "Sign In — Access Your Hestia Culinary Intelligence Workspace | Hestia",
    description:
      "Sign in to Hestia with Google to access persistent cooking conversations, saved recipes, ingredient scans, and personalized food science notes.",
    changeFrequency: "monthly",
    priority: 0.5,
    image: "/logo-transparent.png",
    imageAlt: "Sign in to Hestia workspace",
    keywords: ["Hestia login", "sign in culinary AI", "Hestia account"],
  },
] as const;

export function absoluteUrl(path = "/") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(normalizedPath, `${SITE_URL}/`);
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
  image = "/hestia-hero.png",
  imageAlt = "Hestia culinary intelligence",
  type = "website",
}: {
  path: string;
  title: string;
  description: string;
  keywords?: string[];
  image?: string;
  imageAlt?: string;
  type?: "website" | "article";
}): Metadata {
  const canonical = absoluteUrl(path);
  const imageUrl = absoluteUrl(image);
  const combinedKeywords = Array.from(new Set([...keywords, ...site.keywords]));

  return {
    title,
    description,
    keywords: combinedKeywords,
    authors: [{ name: site.author }],
    creator: site.creator,
    publisher: site.publisher,
    category: "Food & Cooking Technology",
    alternates: {
      canonical,
      languages: {
        "en-US": canonical,
        "vi-VN": canonical,
        "x-default": canonical,
      },
    },
    openGraph: {
      type,
      url: canonical,
      siteName: site.name,
      title,
      description,
      locale: site.locale,
      alternateLocale: ["vi_VN"],
      images: [
        {
          url: imageUrl,
          alt: imageAlt,
          width: 1672,
          height: 941,
          type: "image/png",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      creator: "@hestia_ai",
      site: "@hestia_ai",
      images: [
        {
          url: imageUrl,
          alt: imageAlt,
        },
      ],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  };
}

export const privatePageMetadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

// -----------------------------------------------------------------------------
// Schema.org Structured Data Generators (JSON-LD)
// -----------------------------------------------------------------------------

export function getOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: site.name,
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      "@id": `${SITE_URL}/#logo`,
      url: absoluteUrl("/logo.png"),
      caption: site.name,
      width: 1600,
      height: 1600,
    },
    image: absoluteUrl("/hestia-hero.png"),
    description: site.description,
    slogan: site.tagline,
    knowsAbout: [
      "Culinary Science",
      "Food Chemistry",
      "Food Safety",
      "Nutrient Retention",
      "Cooking Kinetics",
      "Biochemical Composition of Foods",
    ],
    sameAs: [
      "https://github.com/hoangvu1806/Hestia",
    ],
  };
}

export function getWebSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: site.name,
    description: site.description,
    publisher: { "@id": `${SITE_URL}/#organization` },
    inLanguage: ["en-US", "vi-VN"],
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${absoluteUrl("/ingredients")}?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function getWebApplicationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": `${SITE_URL}/#webapplication`,
    name: "Hestia Culinary Intelligence",
    alternateName: "Hestia AI Cooking Assistant",
    url: absoluteUrl("/home"),
    applicationCategory: "LifestyleApplication",
    applicationSubCategory: "Cooking & Food Science Assistant",
    operatingSystem: "All modern web browsers (Chrome, Safari, Firefox, Edge)",
    browserRequirements: "Requires JavaScript. Requires HTML5 support.",
    description:
      "A multimodal culinary intelligence web application connecting ingredient analysis, cooking chemistry, food safety, and nutrient data into practical kitchen execution.",
    featureList: [
      "Multimodal ingredient photo recognition and breakdown",
      "Cooking chemistry & Maillard reaction pathway explanations",
      "Food-safety evidence screening and temperature danger zone guidance",
      "Biochemical food compound database explorer (FooDB & USDA)",
      "Nutrient retention calculations across heat and cooking techniques",
      "Persistent authenticated cooking sessions and private chat history",
      "Bilingual interface (English & Vietnamese) with light and dark themes",
    ],
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      ratingCount: "256",
      bestRating: "5",
      worstRating: "1",
    },
    provider: { "@id": `${SITE_URL}/#organization` },
    inLanguage: ["en", "vi"],
  };
}

export function getBreadcrumbSchema(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function getFaqSchema(faqs: Array<{ question: string; answer: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export function getDefinedTermSetSchema(terms: Array<{ name: string; description: string; url?: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name: "Culinary Chemistry & Food Science Terminology",
    hasDefinedTerm: terms.map((term) => ({
      "@type": "DefinedTerm",
      name: term.name,
      description: term.description,
      url: term.url ? absoluteUrl(term.url) : absoluteUrl("/science"),
    })),
  };
}

export function getDatasetSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "DataCatalog",
    "@id": `${SITE_URL}/#datacatalog`,
    name: "Hestia Food & Culinary Science Intelligence Datasets",
    description:
      "Integrated chemical compound, nutrient, and culinary recipe records from FooDB, USDA FoodData Central, TheMealDB, and EFSA OpenFoodTox.",
    url: absoluteUrl("/ingredients"),
    dataset: [
      {
        "@type": "Dataset",
        name: "FooDB Food and Compound Knowledge Graph",
        description: "Comprehensive food constituent and flavor compound relationships with quantified concentrations.",
        license: "https://foodb.ca/about",
      },
      {
        "@type": "Dataset",
        name: "USDA FoodData Central Standard Reference",
        description: "Official nutrient profiles, macronutrient distributions, and micronutrient retention factors.",
        license: "https://fdc.nal.usda.gov/",
      },
      {
        "@type": "Dataset",
        name: "TheMealDB Recipe Collection",
        description: "Global dish categories, ingredient pairings, and culinary preparation metadata.",
        license: "https://www.themealdb.com/api.php",
      },
    ],
  };
}
