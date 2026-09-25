import Link from "next/link";

import { Brand } from "./brand";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <Brand name="Hestia" tagline="Culinary intelligence" />
        <p>Evidence-aware guidance for more confident decisions in the kitchen.</p>
      </div>
      <div className="footer-links">
        <div><strong>Product</strong><Link href="/chat">Ask Hestia</Link><Link href="/ingredients">Ingredients</Link><Link href="/download">Mobile apps</Link></div>
        <div><strong>Explore</strong><Link href="/science">Food science</Link><Link href="/about">About</Link></div>
        <div><strong>Principles</strong><span>Evidence first</span><span>Uncertainty visible</span><span>Cooking stays human</span></div>
      </div>
      <div className="footer-bottom"><span>© 2026 Hestia</span><span>Food guidance is informational, not medical advice.</span></div>
    </footer>
  );
}
