import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd } from "@/components/json-ld";
import { MarketingShell } from "@/components/marketing-shell";
import { SectionHero } from "@/components/section-hero";
import { absoluteUrl, getBreadcrumbSchema, pageMetadata } from "@/lib/site";

// Update these together whenever public/downloads/hestia-android.apk is replaced.
const ANDROID_APK = {
  path: "/downloads/hestia-android.apk",
  version: "1.0.0",
  size: "28.6 MB",
  minAndroid: "Android 7.0",
  sha256: "89ee62fbd98341ebeaed3184ce7f3a1fb423f4c41e9e7c0246c2e7f2913aeb69",
};

export const metadata: Metadata = pageMetadata({
  path: "/download",
  title: "Download Hestia for Android — AI Cooking & Food Safety Assistant | Hestia",
  description:
    "Download the Hestia Android app: photograph ingredients, check cooking safety and food chemistry with cited sources. Free APK for Android 7.0 and later.",
  keywords: [
    "Hestia APK",
    "Hestia Android app",
    "cooking app Android",
    "food safety app",
    "AI cooking companion app",
    "food chemistry app",
  ],
  image: "/hestia-hero.webp",
  imageAlt: "Hestia Android application download",
});

const androidAppSchema = {
  "@context": "https://schema.org",
  "@type": "MobileApplication",
  name: "Hestia",
  operatingSystem: `${ANDROID_APK.minAndroid} or later`,
  applicationCategory: "LifestyleApplication",
  softwareVersion: ANDROID_APK.version,
  fileSize: ANDROID_APK.size,
  downloadUrl: absoluteUrl(ANDROID_APK.path),
  url: absoluteUrl("/download"),
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    androidAppSchema,
    getBreadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Download", path: "/download" },
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
            <span>ANDROID</span>
            <strong>{ANDROID_APK.version.split(".").slice(0, 2).join(".")}</strong>
            <small>Available now</small>
          </div>
        }
        copy="Install Hestia on your Android phone to photograph ingredients, ask about a dish and get cited food-safety answers. Same account and history as the web app."
        eyebrow="Hestia, everywhere"
        title="Hestia is now on Android."
      />
      <section className="download-grid site-container">
        <article className="download-card android">
          <span>ANDROID · AVAILABLE</span>
          <div className="phone-silhouette">
            <i />
            <div>
              <b>Hestia</b>
              <small>Cook with evidence</small>
            </div>
          </div>
          <h2>Hestia for Android</h2>
          <p>
            Take a photo of your ingredients straight from the chat, browse the food library and
            pick up your conversations from the web.
          </p>
          <a className="download-action" download href={ANDROID_APK.path}>
            Download APK <span>↓</span>
          </a>
          <div className="download-meta">
            <span>Version <b>{ANDROID_APK.version}</b></span>
            <span>Size <b>{ANDROID_APK.size}</b></span>
            <span>Requires <b>{ANDROID_APK.minAndroid}+</b></span>
          </div>
          <p className="download-checksum">SHA-256 {ANDROID_APK.sha256}</p>
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
            A native iPhone app is planned. Until then, open Hestia in Safari and add it to your
            Home Screen.
          </p>
          <button disabled type="button">
            App Store coming later
          </button>
        </article>
      </section>
      <section className="install-steps site-container">
        <div>
          <span>INSTALL ON ANDROID</span>
          <h2>Three steps, about a minute.</h2>
        </div>
        <ol>
          <li>
            <span>
              Open this page on your phone and tap <b>Download APK</b>.
            </span>
          </li>
          <li>
            <span>
              Open the downloaded file. If Android asks, allow your browser to{" "}
              <b>install unknown apps</b>, then return and tap <b>Install</b>.
            </span>
          </li>
          <li>
            <span>
              Open Hestia and <b>sign in with Google</b>. Your chats sync with the web app.
            </span>
          </li>
        </ol>
      </section>
      <section className="web-available site-container">
        <div>
          <span className="availability-dot" /> ALSO ON THE WEB
        </div>
        <h2>No phone nearby? Use the web app.</h2>
        <p>
          No installation required. Open Hestia from any modern browser and start with a photo or
          question.
        </p>
        <Link className="site-cta dark" href="/chat">
          Open web app <span>↗</span>
        </Link>
      </section>
    </MarketingShell>
  );
}
