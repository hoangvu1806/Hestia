import type { Metadata } from "next";

import { FoodLibrary } from "@/components/food-library";
import { MarketingShell } from "@/components/marketing-shell";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  path: "/ingredients",
  title: "Ingredient, nutrient, and food compound explorer",
  description:
    "Search dishes and ingredients, compare nutrient records, and explore food compounds from FooDB, USDA FoodData Central, and TheMealDB.",
  keywords: [
    "ingredient database",
    "food compounds",
    "FooDB",
    "USDA FoodData Central",
    "nutrition search",
    "recipe ingredient explorer",
  ],
});

export default function IngredientsPage() {
  return <MarketingShell><FoodLibrary /></MarketingShell>;
}
