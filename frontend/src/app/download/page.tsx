import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd } from "@/components/json-ld";
import { MarketingShell } from "@/components/marketing-shell";
import { SectionHero } from "@/components/section-hero";
import { absoluteUrl, getBreadcrumbSchema, pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  path: "/download",
  title: "Hestia Mobile Apps — Android & iOS Culinary Assistant Roadmap | Hestia",
  description:
    "Explore the roadmap for Hestia native Android and iOS mobile applications, or experience the complete culinary intelligence platform in your web browser today.",
  keywords: [
    "cooking app Android",
    "food science app iPhone",
    "culinary assistant mobile",
    "Hestia app download",
    "AI cooking companion app",
    "mobile recipe chemistry",
  ],
  image: "/hestia-hero.webp",
  imageAlt: "Hestia mobile application roadmap for Android and iOS",
});

const mobileAppSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Hestia mobile roadmap",
  description:
    "Roadmap information for possible native Android and iOS Hestia clients. No native application is currently released.",
  url: absoluteUrl("/download"),
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    mobileAppSchema,
    getBreadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Mobile Applications", path: "/download" },
    ]),
  ],
};

export default function DownloadPage() {
  return (
    <MarketingShell>
      <JsonLd data={structuredData} />
      <SectionHero
        aside={
          <div className="release-stamp">
            <span>MOBILE</span>
            <strong>2027</strong>
            <small>Development roadmap</small>
          </div>
        }
        copy="Native Android and iOS experiences are in development. The web app is available today on desktop, tablet, and mobile browsers."
        eyebrow="Hestia, everywhere"
        title="A calmer cooking companion is coming to mobile."
      />
      <section className="download-grid site-container">
        <article className="download-card android">
          <span>ANDROID</span>
          <div className="phone-silhouette">
            <i />
            <div>
              <b>Hestia</b>
              <small>Cook with evidence</small>
            </div>
          </div>
          <h2>Hestia for Android</h2>
          <p>
            Camera-first ingredient capture, live cooking checkpoints, and saved
            evidence trails.
          </p>
          <button disabled type="button">
            APK coming later
          </button>
        </article>
        <article className="download-card ios">
          <span>iOS</span>
          <div className="phone-silhouette">
            <i />
            <div>
              <b>Hestia</b>
              <small>Your kitchen, understood</small>
            </div>
          </div>
          <h2>Hestia for iPhone</h2>
          <p>
            A native companion designed around one-handed use, timers, photos,
            and clear safety controls.
          </p>
          <button disabled type="button">
            App Store coming later
          </button>
        </article>
      </section>
      <section className="web-available site-container">
        <div>
          <span className="availability-dot" /> AVAILABLE NOW
        </div>
        <h2>Use the complete experience on the web.</h2>
        <p>
          No installation required. Open Hestia from any modern browser and start
          with a photo or question.
        </p>
        <Link className="site-cta dark" href="/chat">
          Open web app <span>↗</span>
        </Link>
      </section>
    </MarketingShell>
  );
}
