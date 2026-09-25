import type { Metadata } from "next";

import { FoodLibrary } from "@/components/food-library";
import { JsonLd } from "@/components/json-ld";
import { MarketingShell } from "@/components/marketing-shell";
import { getBreadcrumbSchema, getDatasetSchema, pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  path: "/ingredients",
  title: "Food & Ingredient Intelligence Explorer — Compounds, Nutrition & Chemistry | Hestia",
  description:
    "Search dishes and ingredients, compare USDA nutrient records, and explore biochemical compounds from FooDB, USDA FoodData Central, and TheMealDB.",
  keywords: [
    "food compound database",
    "ingredient database",
    "FooDB search",
    "USDA FoodData Central",
    "nutrition search",
    "recipe ingredient explorer",
    "culinary chemistry",
    "food constituent analysis",
    "flavor compounds",
    "macronutrients and micronutrients",
  ],
  image: "/ingredient-intelligence.png",
  imageAlt: "Hestia ingredient intelligence, food compounds, and nutrient explorer",
});

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    getDatasetSchema(),
    getBreadcrumbSchema([
      { name: "Home", path: "/home" },
      { name: "Ingredients Explorer", path: "/ingredients" },
    ]),
  ],
};

export default function IngredientsPage() {
  return (
    <MarketingShell>
      <JsonLd data={structuredData} />
      <FoodLibrary />
    </MarketingShell>
  );
}
