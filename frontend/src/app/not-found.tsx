import Image from "next/image";
import Link from "next/link";

import { MarketingShell } from "@/components/marketing-shell";

export default function NotFound() {
  return (
    <MarketingShell>
      <main className="not-found-page">
        <div className="not-found-copy">
          <span className="site-eyebrow"><i /> Error 404 · Lost recipe</span>
          <p className="not-found-number" aria-hidden="true">404</p>
          <h1>This plate has no recipe yet.</h1>
          <p>
            The address may have changed, or this page was never on the menu.
            Return home or open the Food Library to keep exploring.
          </p>
          <div className="hero-actions">
            <Link className="site-cta dark" href="/">Back to Hestia <span>↗</span></Link>
            <Link className="text-link" href="/ingredients">Explore the library <span>→</span></Link>
          </div>
        </div>
        <div className="not-found-art">
          <span className="not-found-orbit" aria-hidden="true" />
          <Image
            alt="An empty plate surrounded by ingredients drifting along an unfinished orbit"
            height={1024}
            priority
            src="/hestia-404.webp"
            width={1024}
          />
          <small>Nothing wasted · choose another path</small>
        </div>
      </main>
    </MarketingShell>
  );
}
