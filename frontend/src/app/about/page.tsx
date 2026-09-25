import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd } from "@/components/json-ld";
import { MarketingShell } from "@/components/marketing-shell";
import { SectionHero } from "@/components/section-hero";
import {
  getBreadcrumbSchema,
  getFaqSchema,
  getOrganizationSchema,
  pageMetadata,
} from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  path: "/about",
  title: "About Hestia — Evidence-Aware AI Culinary Intelligence & Mission | Hestia",
  description:
    "Learn how Hestia connects practical cooking execution with peer-reviewed food science, transparent assumptions, verified chemical databases, and visible uncertainty.",
  keywords: [
    "about Hestia",
    "culinary AI mission",
    "evidence-aware AI",
    "responsible cooking assistant",
    "food science AI",
    "transparent cooking intelligence",
    "kitchen AI ethics",
  ],
  image: "/logo-transparent.png",
  imageAlt: "Hestia culinary intelligence team and philosophy",
});

const aboutFaqs = [
  {
    question: "Why was Hestia created?",
    answer:
      "Most cooking assistants simply generate text recipes with no verification. Hestia was designed to bridge culinary execution and food science by verifying claims against chemical databases (FooDB), nutrient retention datasets (USDA), and peer-reviewed literature.",
  },
  {
    question: "How does Hestia handle uncertainty in cooking recommendations?",
    answer:
      "Hestia explicitly flags ambiguous ingredients (such as unknown clear liquids or ground spice mixes) rather than guessing, and distinguishes established physical laws from empirical kitchen approximations.",
  },
  {
    question: "Who develops Hestia?",
    answer:
      "Hestia is developed by culinary technologists and software engineers dedicated to making food chemistry, nutrition, and microbial safety transparent, accessible, and practical for every home cook and professional chef.",
  },
];

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    getOrganizationSchema(),
    getBreadcrumbSchema([
      { name: "Home", path: "/home" },
      { name: "About Hestia", path: "/about" },
    ]),
    getFaqSchema(aboutFaqs),
  ],
};

export default function AboutPage() {
  return (
    <MarketingShell>
      <JsonLd data={structuredData} />
      <SectionHero
        copy="Recipes tell us what to do. Food science tells us why it works. Hestia brings those two worlds together without turning dinner into a laboratory report."
        eyebrow="Why Hestia exists"
        title="Better cooking begins with better explanations."
      />
      <section className="manifesto site-container">
        <p>
          We believe useful AI should show its assumptions, respect uncertainty,
          and leave people more capable than before they asked.
        </p>
        <div>
          <span>01</span>
          <h3>Practical first</h3>
          <p>
            Every analysis returns to an action a person can take in a real
            kitchen.
          </p>
        </div>
        <div>
          <span>02</span>
          <h3>Evidence where it matters</h3>
          <p>
            Sources support consequential claims without making ordinary advice
            unreadable.
          </p>
        </div>
        <div>
          <span>03</span>
          <h3>Visual when useful</h3>
          <p>
            Charts, pathways, tables, and illustrations are selected by the shape
            of the information.
          </p>
        </div>
      </section>
      <section className="about-band">
        <div className="site-container">
          <span className="site-eyebrow light">The name</span>
          <h2>Hestia was the keeper of the hearth.</h2>
          <p>This Hestia keeps the intelligence around it.</p>
        </div>
      </section>
      <section className="inline-cta site-container">
        <div>
          <span className="site-eyebrow">Experience the idea</span>
          <h2>Ask a question worth investigating.</h2>
        </div>
        <Link className="site-cta dark" href="/chat">
          Meet Hestia <span>↗</span>
        </Link>
      </section>
    </MarketingShell>
  );
}
