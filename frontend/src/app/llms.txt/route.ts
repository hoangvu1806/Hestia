import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-static";

export function GET() {
  const content = `# Hestia

> Hestia is an open-source culinary intelligence application for ingredient exploration, cooking science, food-safety context, and evidence-aware kitchen guidance.

## Canonical website

- [Hestia](${absoluteUrl("/")}): Product overview and entry point.

## Public documentation and tools

- [Food Library](${absoluteUrl("/ingredients")}): Search dishes, ingredients, nutrient records, and food compounds.
- [Food science](${absoluteUrl("/science")}): Read Hestia's approach to cooking chemistry, safety, calculations, and evidence.
- [About](${absoluteUrl("/about")}): Project scope and editorial principles.
- [Mobile roadmap](${absoluteUrl("/download")}): Current status of planned mobile clients.
- [Source code](https://github.com/hoangvu1806/Hestia): Repository, setup instructions, and license information.

## Data and answer policy

Hestia may use FooDB for food compounds, USDA FoodData Central for nutrient records, TheMealDB for dish and ingredient data, EFSA OpenFoodTox and PubChem for chemical context, and scholarly search for relevant literature. A source being available does not mean every answer uses it. Hestia should distinguish observed facts, user-provided facts, database records, calculations, and model inference. Food guidance is informational and is not medical advice.

## Access

Public pages may be crawled. Chat history, account settings, uploads, generated images, and other authenticated user data are private and are not part of the public corpus. The production service is available only at ${absoluteUrl("/")}.

## Contact

- [Developer](https://hoangvu.id.vn)
- [Vectorium](https://vectorium.space)
`;

  return new Response(content, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
