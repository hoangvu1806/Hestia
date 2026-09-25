import Link from "next/link";

import { Brand } from "./brand";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <Brand name="Hestia" tagline="Culinary intelligence" />
        <p>Evidence-aware guidance for more confident decisions in the kitchen.</p>
        <a className="footer-live" href="https://hestia.vectorium.space/" rel="noreferrer" target="_blank"><i /> Live at hestia.vectorium.space</a>
      </div>
      <div className="footer-links">
        <div><strong>Product</strong><Link href="/chat">Ask Hestia</Link><Link href="/ingredients">Food Library</Link><Link href="/science">Food science</Link><Link href="/download">Mobile roadmap</Link></div>
        <div><strong>Project</strong><Link href="/about">About Hestia</Link><a href="https://github.com/hoangvu1806/Hestia" rel="noreferrer" target="_blank">Source code ↗</a><Link href="/llms.txt">LLM guide</Link></div>
        <div><strong>Connect</strong><a href="https://hoangvu.id.vn" rel="noreferrer" target="_blank">Developer · hoangvu.id.vn ↗</a><a href="https://vectorium.space" rel="noreferrer" target="_blank">Vectorium ↗</a><a href="https://hestia.vectorium.space/" rel="noreferrer" target="_blank">Production site ↗</a></div>
        <div><strong>Principles</strong><span>Evidence close to claims</span><span>Uncertainty stays visible</span><span>Cooking guidance, not medical advice</span></div>
      </div>
      <div className="footer-bottom"><span>© 2026 Hestia · Open-source culinary intelligence</span><span>Data sources retain their respective terms and attribution.</span></div>
    </footer>
  );
}
