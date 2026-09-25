import Image from "next/image";
import Link from "next/link";

import { MarketingShell } from "@/components/marketing-shell";

const capabilities = [
  { index: "01", title: "See what is on the counter", copy: "Share an image. Hestia separates visible ingredients from uncertain guesses before suggesting what to cook.", tone: "coral" },
  { index: "02", title: "Understand what heat changes", copy: "Follow reactions, nutrient retention, texture, browning, and meaningful hazards without reading a textbook.", tone: "green" },
  { index: "03", title: "Turn evidence into dinner", copy: "Get quantities, checkpoints, comparisons, sources, and visual instructions shaped around the dish you are actually making.", tone: "violet" },
];

export default function HomePage() {
  return (
    <MarketingShell>
      <section className="home-hero">
        <Image alt="A plated dish surrounded by fresh ingredients and culinary science tools" fill priority sizes="100vw" src="/hestia-hero.png" />
        <div className="home-hero-shade" />
        <div className="home-hero-content site-container">
          <span className="site-eyebrow light"><i /> Culinary intelligence, grounded in evidence</span>
          <h1>Cook with evidence.<br /><em>Eat with confidence.</em></h1>
          <p>Hestia connects what you have, what happens during cooking, and what matters for safety into one clear path from ingredient to plate.</p>
          <div className="hero-actions"><Link className="site-cta" href="/chat">Ask Hestia <span>↗</span></Link><Link className="text-link light" href="/science">Explore the science <span>→</span></Link></div>
          <div className="hero-proof"><div><strong>Multimodal</strong><span>Start with a photo or a question</span></div><div><strong>Evidence-aware</strong><span>Sources stay close to the claim</span></div><div><strong>Kitchen-ready</strong><span>Advice ends in an action</span></div></div>
        </div>
        <div className="hero-orbit-card"><span>LIVE ANALYSIS</span><strong>Ingredient → reaction → decision</strong><div className="orbit-line"><i /><i /><i /></div><small>Reasoning you can inspect</small></div>
      </section>

      <section className="source-ribbon"><span>BUILT AROUND TRUSTED FOOD DATA</span><div><strong>FooDB</strong><strong>USDA</strong><strong>OpenFoodTox</strong><strong>PubChem</strong><strong>Scientific literature</strong></div></section>

      <section className="capability-section site-container">
        <div className="section-heading"><span className="site-eyebrow">From uncertainty to action</span><h2>A second pair of eyes<br />for the whole cooking process.</h2><p>Not another recipe generator. Hestia builds a small, transparent case around your ingredients and the decision in front of you.</p></div>
        <div className="capability-grid">{capabilities.map((item) => <article className={`capability-card ${item.tone}`} key={item.index}><span>{item.index}</span><div className="capability-glyph"><i /><i /><i /></div><h3>{item.title}</h3><p>{item.copy}</p></article>)}</div>
      </section>

      <section className="intelligence-feature site-container">
        <div className="feature-image"><Image alt="Fresh ingredients arranged for food analysis" fill sizes="(max-width: 800px) 100vw, 54vw" src="/ingredient-intelligence.png" /><div className="scan-marker one"><i /> Bok choy <small>high confidence</small></div><div className="scan-marker two"><i /> Salmon <small>protein pathway</small></div></div>
        <div className="feature-copy"><span className="site-eyebrow">Ingredient intelligence</span><h2>It starts by being honest about what it sees.</h2><p>Hestia separates observation, user-confirmed facts, and inference. That simple discipline makes every recommendation downstream more useful.</p><ul><li><span>01</span><div><strong>Identify with uncertainty</strong><small>Ambiguous liquids and ingredients stay ambiguous until confirmed.</small></div></li><li><span>02</span><div><strong>Map the chemistry that matters</strong><small>Composition is selected for the actual process, not dumped as a database list.</small></div></li><li><span>03</span><div><strong>Show the evidence trail</strong><small>Citations, calculations, and assumptions remain visible.</small></div></li></ul><Link className="text-link" href="/ingredients">See ingredient intelligence <span>→</span></Link></div>
      </section>

      <section className="process-section">
        <div className="site-container"><div className="section-heading inverse"><span className="site-eyebrow light">One connected workflow</span><h2>From a messy counter<br />to a clear next move.</h2></div><div className="process-track"><article><span>Observe</span><strong>What is actually here?</strong><p>Image and context become a careful ingredient brief.</p></article><article><span>Verify</span><strong>What can happen?</strong><p>Relevant chemistry and safety pathways are checked.</p></article><article><span>Solve</span><strong>What changes the decision?</strong><p>Quantities become calculations, comparisons, and controls.</p></article><article><span>Cook</span><strong>What should I do now?</strong><p>Evidence becomes an ordered, practical cooking plan.</p></article></div></div>
      </section>

      <section className="decision-section site-container"><div className="decision-copy"><span className="site-eyebrow">Designed for decisions</span><h2>Science, without losing the pleasure of cooking.</h2><p>Visual pathways explain a mechanism. Charts compare real quantities. AI illustrations clarify shape and assembly. Hestia chooses the medium that makes the next decision easier.</p><Link className="site-cta dark" href="/chat">Try a real cooking question <span>↗</span></Link></div><div className="decision-board"><div className="board-label">HEAT × TIME / LIVE MODEL</div><div className="mini-bars"><i /><i /><i /><i /><i /></div><div className="board-path"><span>raw</span><b>→</b><span>aroma</span><b>→</b><span>control</span><b>→</b><span>serve</span></div><small>Visuals are built from sourced or calculated information, never invented confidence scores.</small></div></section>

      <section className="home-cta site-container"><span className="site-eyebrow light">Bring your own ingredients</span><h2>There is a better question than<br /><em>“What recipe matches this?”</em></h2><p>Ask what is possible, what changes under heat, and how to make it work safely.</p><Link className="site-cta pale" href="/chat">Start cooking with Hestia <span>↗</span></Link></section>
    </MarketingShell>
  );
}
