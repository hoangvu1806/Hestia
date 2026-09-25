import type { Metadata } from "next";
import Link from "next/link";

import { MarketingShell } from "@/components/marketing-shell";
import { SectionHero } from "@/components/section-hero";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  path: "/science",
  title: "Cooking chemistry and food-safety science",
  description:
    "Understand browning, protein denaturation, nutrient retention, heat, pH, moisture, and food-safety pathways in practical kitchen terms.",
  keywords: [
    "cooking chemistry",
    "food science",
    "Maillard reaction",
    "protein denaturation",
    "nutrient retention",
    "food safety science",
  ],
});

export default function SciencePage() {
  return <MarketingShell><SectionHero eyebrow="Food science, made usable" title="Understand the change, not just the recipe." copy="Hestia turns cooking questions into small scientific problems, then brings the answer back to heat, time, texture, nutrition, and safety." aside={<div className="molecule-orbit"><i /><i /><i /><b>C₆H₁₂O₆</b></div>} />
    <section className="editorial-grid site-container"><article className="editorial-lead"><span>01 / TRANSFORMATIONS</span><h2>Follow the path from ingredient to outcome.</h2><p>Explore browning, acid–base behavior, protein denaturation, moisture movement, nutrient retention, and hazard formation under the conditions of your dish.</p></article><article><span>02 / CALCULATION</span><h3>Numbers with units and assumptions</h3><p>Dilution, yield, retention, mass fraction, stoichiometry, and thermal-equivalent time are solved transparently.</p></article><article><span>03 / EVIDENCE</span><h3>Claims stay attached to sources</h3><p>Hestia distinguishes database records, deterministic calculations, supported inference, and unresolved uncertainty.</p></article></section>
    <section className="science-matrix site-container"><div><span>QUESTION</span><strong>Why did this change?</strong></div><b>→</b><div><span>CONDITIONS</span><strong>Heat · time · water · pH</strong></div><b>→</b><div><span>PATHWAY</span><strong>Mechanism and evidence</strong></div><b>→</b><div><span>DECISION</span><strong>What to do differently</strong></div></section>
    <section className="standards-section site-container"><div><span className="site-eyebrow">A visible standard</span><h2>What Hestia will not pretend to know.</h2></div><div className="standards-list"><p><span>01</span>Appearance alone does not prove food is safe.</p><p><span>02</span>A compound in a food database does not prove a reaction occurred.</p><p><span>03</span>A hazard record is not the same as real serving-level exposure.</p><p><span>04</span>Missing evidence is reported, not replaced with invented precision.</p></div></section>
    <section className="inline-cta site-container"><div><span className="site-eyebrow">Put it to work</span><h2>Bring a difficult cooking question.</h2></div><Link className="site-cta dark" href="/chat">Ask Hestia <span>↗</span></Link></section>
  </MarketingShell>;
}
