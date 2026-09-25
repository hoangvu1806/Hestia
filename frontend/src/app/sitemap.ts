import type { MetadataRoute } from "next";

import { absoluteUrl, indexableRoutes } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return indexableRoutes.map((route) => ({
    url: absoluteUrl(route.path),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
    images: route.image ? [absoluteUrl(route.image)] : undefined,
  }));
}
