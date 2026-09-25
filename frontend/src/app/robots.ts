import type { MetadataRoute } from "next";

import { absoluteUrl, site } from "@/lib/site";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  const sitemapUrl = absoluteUrl("/sitemap.xml");

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/home/",
          "/ingredients/",
          "/science/",
          "/about/",
          "/download/",
          "/login/",
          "/manifest.webmanifest",
          "/llms.txt",
          "/llms-full.txt",
        ],
        disallow: [
          "/api/",
          "/_next/private/",
          "/chat/",
          "/settings/",
        ],
      },
      {
        userAgent: [
          "Googlebot",
          "Googlebot-Image",
          "Bingbot",
          "Applebot",
          "Slurp",
          "DuckDuckBot",
          "Baiduspider",
          "YandexBot",
        ],
        allow: "/",
        disallow: ["/api/", "/chat/", "/settings/"],
      },
      {
        // Explicitly enable AI Search Bots and LLM agents for maximum visibility & citations
        userAgent: [
          "GPTBot",
          "ChatGPT-User",
          "ClaudeBot",
          "Claude-Web",
          "PerplexityBot",
          "Google-Extended",
          "Amazonbot",
          "cohere-ai",
          "omgili",
          "anthropic-ai",
          "Bytespider",
        ],
        allow: [
          "/",
          "/home/",
          "/ingredients/",
          "/science/",
          "/about/",
          "/download/",
          "/llms.txt",
          "/llms-full.txt",
        ],
        disallow: ["/api/", "/chat/", "/settings/"],
      },
    ],
    sitemap: sitemapUrl,
    host: site.url,
  };
}
