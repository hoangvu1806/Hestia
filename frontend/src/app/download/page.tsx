import type { Metadata } from "next";
import Link from "next/link";

import { MarketingShell } from "@/components/marketing-shell";
import { SectionHero } from "@/components/section-hero";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  path: "/download",
  title: "Hestia mobile apps",
  description:
    "See the roadmap for Hestia on Android and iPhone, or use the complete evidence-based cooking experience in your browser today.",
  keywords: ["cooking app", "food science app", "Hestia Android", "Hestia iPhone"],
});

export default function DownloadPage() {
  return <MarketingShell><SectionHero eyebrow="Hestia, everywhere" title="A calmer cooking companion is coming to mobile." copy="Native Android and iOS experiences are in development. The web app is available today on desktop, tablet, and mobile browsers." aside={<div className="release-stamp"><span>MOBILE</span><strong>2027</strong><small>Development roadmap</small></div>} />
    <section className="download-grid site-container"><article className="download-card android"><span>ANDROID</span><div className="phone-silhouette"><i /><div><b>Hestia</b><small>Cook with evidence</small></div></div><h2>Hestia for Android</h2><p>Camera-first ingredient capture, live cooking checkpoints, and saved evidence trails.</p><button disabled type="button">APK coming later</button></article><article className="download-card ios"><span>iOS</span><div className="phone-silhouette"><i /><div><b>Hestia</b><small>Your kitchen, understood</small></div></div><h2>Hestia for iPhone</h2><p>A native companion designed around one-handed use, timers, photos, and clear safety controls.</p><button disabled type="button">App Store coming later</button></article></section>
    <section className="web-available site-container"><div><span className="availability-dot" /> AVAILABLE NOW</div><h2>Use the complete experience on the web.</h2><p>No installation required. Open Hestia from any modern browser and start with a photo or question.</p><Link className="site-cta dark" href="/chat">Open web app <span>↗</span></Link></section>
  </MarketingShell>;
}
