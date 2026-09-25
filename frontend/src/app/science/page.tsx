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
  image: "/hestia-hero.png",
  imageAlt: "Hestia food chemistry and culinary science pathways",
});

const scienceTerms = [
  {
    name: "Maillard Reaction",
    description:
      "A non-enzymatic chemical reaction between amino acids and reducing sugars that produces browned flavors, complex aromas, and melanoidin pigments typically above 140°C (284°F).",
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
      "The Maillard reaction is a cascade of chemical reactions between reducing sugars and amino acids that occurs rapidly between 140°C and 165°C. Minimizing surface moisture before searing is essential because evaporating surface water consumes thermal energy and delays the browning reaction.",
  },
  {
    question: "What temperature causes protein denaturation in meat and eggs?",
    answer:
      "Myosin heads denature at approximately 40°C–50°C (104°F–122°F), collagen shortens at 60°C–65°C (140°F–149°F), and actin denatures around 66°C–73°C (151°F–163°F), expelling intracellular moisture and firming the protein matrix.",
  },
  {
    question: "Why does steaming retain more nutrients than boiling?",
    answer:
      "Water-soluble vitamins (such as Vitamin C and B-complex vitamins) leach directly into surrounding water during submersion boiling. Steaming minimizes direct contact with liquid water, preserving 80% to 95% of water-soluble micronutrients.",
  },
];

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    getBreadcrumbSchema([
      { name: "Home", path: "/home" },
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
