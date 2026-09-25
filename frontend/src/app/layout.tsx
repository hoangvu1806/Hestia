import type { Metadata } from "next";
import { Cormorant_Garamond, Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";

import "katex/dist/katex.min.css";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { JsonLd } from "@/components/json-ld";
import { absoluteUrl, site } from "@/lib/site";

const themeScript = `(() => { try { const saved = localStorage.getItem('hestia-theme'); const systemDark = matchMedia('(prefers-color-scheme: dark)').matches; document.documentElement.dataset.theme = saved || (systemDark ? 'dark' : 'light'); document.documentElement.lang = localStorage.getItem('hestia-locale') || 'en'; } catch (_) {} })();`;

const jakarta = Plus_Jakarta_Sans({
  display: "swap",
  subsets: ["latin", "vietnamese"],
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700", "800"],
});

const cormorant = Cormorant_Garamond({
  display: "swap",
  subsets: ["latin", "vietnamese"],
  variable: "--font-editorial",
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: site.title, template: "%s | Hestia" },
  description: site.description,
  applicationName: site.name,
  authors: [{ name: "Hestia" }],
  creator: "Hestia",
  publisher: "Hestia",
  category: "Food science and culinary technology",
  referrer: "origin-when-cross-origin",
  keywords: [
    "evidence-based cooking",
    "food science",
    "cooking chemistry",
    "food safety",
    "ingredient analysis",
    "culinary AI",
    "nutrition data",
  ],
  alternates: { canonical: "/home" },
  icons: {
    icon: [{ url: "/logo.png", type: "image/png" }],
    apple: "/logo.png",
  },
  manifest: "/manifest.webmanifest",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    url: "/home",
    siteName: site.name,
    title: site.title,
    description: site.description,
    locale: site.locale,
    images: [
      {
        url: "/hestia-hero.png",
        alt: "Hestia culinary intelligence",
        width: 1672,
        height: 941,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: site.title,
    description: site.description,
    images: ["/hestia-hero.png"],
  },
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${site.url}/#organization`,
      name: site.name,
      url: site.url,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl("/logo.png"),
      },
    },
    {
      "@type": "WebSite",
      "@id": `${site.url}/#website`,
      url: site.url,
      name: site.name,
      description: site.description,
      publisher: { "@id": `${site.url}/#organization` },
      inLanguage: ["en", "vi"],
    },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className={`${jakarta.variable} ${cormorant.variable}`}>
        <JsonLd data={organizationSchema} />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
