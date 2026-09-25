import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd } from "@/components/json-ld";
import { MarketingShell } from "@/components/marketing-shell";
import { SectionHero } from "@/components/section-hero";
import {
  getBreadcrumbSchema,
  getDefinedTermSetSchema,
  getFaqSchema,
  pageMetadata,
} from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  path: "/science",
  title: "Cooking Chemistry & Food Safety Science — Mechanisms & Heat | Hestia",
  description:
    "Understand browning, Maillard reactions, protein denaturation, nutrient retention kinetics, heat transfer, pH, and food-safety pathways in practical kitchen terms.",
  keywords: [
    "cooking chemistry",
    "food science",
    "Maillard reaction",
    "protein denaturation",
    "nutrient retention cooking",
    "food safety science",
    "temperature danger zone",
    "starch gelatinization",
    "emulsification chemistry",
    "culinary physics",
  ],
  image: "/hestia-hero.webp",
  imageAlt: "Hestia food chemistry and culinary science pathways",
});

const scienceTerms = [
  {
    name: "Maillard Reaction",
    description:
      "A family of non-enzymatic reactions between amino compounds and reducing sugars that contributes to browning and aroma. Rate depends on temperature, time, moisture, pH, and ingredients.",
    url: "/science",
  },
  {
    name: "Protein Denaturation",
    description:
      "The disruption of secondary and tertiary protein structures through heat, acid, or mechanical agitation, transitioning from fluid states to coagulated gel networks.",
    url: "/science",
  },
  {
    name: "Temperature Danger Zone",
    description:
      "The temperature range between 4°C and 60°C (40°F to 140°F) where foodborne bacteria such as Salmonella and Clostridium perfringens multiply rapidly.",
    url: "/science",
  },
  {
    name: "Nutrient Retention Factor",
    description:
      "The percentage of initial vitamins, minerals, and phytonutrients remaining in food after cooking methods such as boiling, steaming, baking, or frying.",
    url: "/science",
  },
];

const scienceFaqs = [
  {
    question: "How does the Maillard reaction work in home cooking?",
    answer:
      "The Maillard reaction is a network of reactions involving amino compounds and reducing sugars. A drier surface and sufficient heat generally favor browning, but the rate also depends on time, pH, and the food itself.",
  },
  {
    question: "What temperature causes protein denaturation in meat and eggs?",
    answer:
      "Different proteins denature across different temperature ranges, and the result depends on time, pH, moisture, and food structure. Hestia avoids treating one temperature as universal for every meat or egg preparation.",
  },
  {
    question: "Why does steaming retain more nutrients than boiling?",
    answer:
      "Boiling can move water-soluble nutrients into the cooking liquid. Steaming reduces direct contact with water, but actual retention varies by food, nutrient, cut size, temperature, and cooking time.",
  },
];

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    getBreadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Food Science & Chemistry", path: "/science" },
    ]),
    getDefinedTermSetSchema(scienceTerms),
    getFaqSchema(scienceFaqs),
  ],
};

export default function SciencePage() {
  return (
    <MarketingShell>
      <JsonLd data={structuredData} />
      <SectionHero
        aside={
          <div className="molecule-orbit">
            <i />
            <i />
            <i />
            <b>C₆H₁₂O₆</b>
          </div>
        }
        copy="Hestia turns cooking questions into small scientific problems, then brings the answer back to heat, time, texture, nutrition, and safety."
        eyebrow="Food science, made usable"
        title="Understand the change, not just the recipe."
      />
      <section className="editorial-grid site-container">
        <article className="editorial-lead">
          <span>01 / TRANSFORMATIONS</span>
          <h2>Follow the path from ingredient to outcome.</h2>
          <p>
            Explore browning, acid–base behavior, protein denaturation, moisture
            movement, nutrient retention, and hazard formation under the
            conditions of your dish.
          </p>
        </article>
        <article>
          <span>02 / CALCULATION</span>
          <h3>Numbers with units and assumptions</h3>
          <p>
            Dilution, yield, retention, mass fraction, stoichiometry, and
            thermal-equivalent time are solved transparently.
          </p>
        </article>
        <article>
          <span>03 / EVIDENCE</span>
          <h3>Claims stay attached to sources</h3>
          <p>
            Hestia distinguishes database records, deterministic calculations,
            supported inference, and unresolved uncertainty.
          </p>
        </article>
      </section>
      <section className="science-matrix site-container">
        <div>
          <span>QUESTION</span>
          <strong>Why did this change?</strong>
        </div>
        <b>→</b>
        <div>
          <span>CONDITIONS</span>
          <strong>Heat · time · water · pH</strong>
        </div>
        <b>→</b>
        <div>
          <span>PATHWAY</span>
          <strong>Mechanism and evidence</strong>
        </div>
        <b>→</b>
        <div>
          <span>DECISION</span>
          <strong>What to do differently</strong>
        </div>
      </section>
      <section className="standards-section site-container">
        <div>
          <span className="site-eyebrow">A visible standard</span>
          <h2>What Hestia will not pretend to know.</h2>
        </div>
        <div className="standards-list">
          <p>
            <span>01</span>Appearance alone does not prove food is safe.
          </p>
          <p>
            <span>02</span>A compound in a food database does not prove a
            reaction occurred.
          </p>
          <p>
            <span>03</span>A hazard record is not the same as real serving-level
            exposure.
          </p>
          <p>
            <span>04</span>Missing evidence is reported, not replaced with
            invented precision.
          </p>
        </div>
      </section>
      <section className="inline-cta site-container">
        <div>
          <span className="site-eyebrow">Put it to work</span>
          <h2>Bring a difficult cooking question.</h2>
        </div>
        <Link className="site-cta dark" href="/chat">
          Ask Hestia <span>↗</span>
        </Link>
      </section>
    </MarketingShell>
  );
}
