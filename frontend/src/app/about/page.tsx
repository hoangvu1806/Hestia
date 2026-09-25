import type { Metadata } from "next";
import Link from "next/link";

import { MarketingShell } from "@/components/marketing-shell";
import { SectionHero } from "@/components/section-hero";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  path: "/about",
  title: "About Hestia",
  description:
    "Learn how Hestia connects practical cooking guidance with transparent assumptions, scientific evidence, and visible uncertainty.",
  keywords: ["Hestia culinary AI", "evidence-aware AI", "responsible cooking assistant"],
});

export default function AboutPage() {
  return <MarketingShell><SectionHero eyebrow="Why Hestia exists" title="Better cooking begins with better explanations." copy="Recipes tell us what to do. Food science tells us why it works. Hestia brings those two worlds together without turning dinner into a laboratory report." />
    <section className="manifesto site-container"><p>We believe useful AI should show its assumptions, respect uncertainty, and leave people more capable than before they asked.</p><div><span>01</span><h3>Practical first</h3><p>Every analysis returns to an action a person can take in a real kitchen.</p></div><div><span>02</span><h3>Evidence where it matters</h3><p>Sources support consequential claims without making ordinary advice unreadable.</p></div><div><span>03</span><h3>Visual when useful</h3><p>Charts, pathways, tables, and illustrations are selected by the shape of the information.</p></div></section>
    <section className="about-band"><div className="site-container"><span className="site-eyebrow light">The name</span><h2>Hestia was the keeper of the hearth.</h2><p>This Hestia keeps the intelligence around it.</p></div></section>
    <section className="inline-cta site-container"><div><span className="site-eyebrow">Experience the idea</span><h2>Ask a question worth investigating.</h2></div><Link className="site-cta dark" href="/chat">Meet Hestia <span>↗</span></Link></section>
  </MarketingShell>;
}
