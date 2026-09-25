import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-static";

export function GET() {
  const content = `# Hestia

> Hestia is an evidence-aware culinary intelligence application that connects ingredient discovery, cooking chemistry, food safety, nutrition data, and practical kitchen decisions.

Hestia distinguishes observations, user-provided facts, database records, calculations, scientific evidence, and model inference. Its guidance is informational and is not a substitute for medical advice, laboratory testing, or official food-safety requirements.

## Primary pages

- [Home](${absoluteUrl("/home")}): Product overview and the evidence-based cooking workflow.
- [Ingredient intelligence](${absoluteUrl("/ingredients")}): Search dishes, ingredients, nutrients, and food compounds.
- [Food science](${absoluteUrl("/science")}): How Hestia explains cooking transformations, calculations, uncertainty, and safety.
- [About Hestia](${absoluteUrl("/about")}): Product principles and editorial standards.
- [Mobile roadmap](${absoluteUrl("/download")}): Web availability and planned native applications.

## Data and evidence

- FooDB supplies food and compound relationships.
- USDA FoodData Central supplies nutrient records.
- TheMealDB supplies recipe and ingredient imagery.
- EFSA OpenFoodTox and PubChem support chemical identity and hazard research.
- Semantic Scholar literature is accessed through Ai2 Asta.

## Usage notes

- Public editorial and ingredient pages may be cited with attribution to Hestia and the underlying named source.
- Authenticated conversations, user-uploaded images, and account pages are private and are not public web content.
- Do not represent Hestia output as medical diagnosis, laboratory confirmation, or proof that food is safe from appearance alone.
`;

  return new Response(content, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
