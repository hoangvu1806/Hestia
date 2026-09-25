import type { MetadataRoute } from "next";

import { absoluteUrl, indexableRoutes } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return indexableRoutes.map((route) => {
    const routeUrl = absoluteUrl(route.path);
    const imageUrl = route.image ? absoluteUrl(route.image) : undefined;

    return {
      url: routeUrl,
      lastModified,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
      alternates: {
        languages: {
          en: routeUrl,
          vi: routeUrl,
          "x-default": routeUrl,
        },
      },
      images: imageUrl ? [imageUrl] : undefined,
    };
  });
}
