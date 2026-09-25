import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";

import "katex/dist/katex.min.css";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { JsonLd } from "@/components/json-ld";
import { absoluteUrl, getOrganizationSchema, getWebSiteSchema, site } from "@/lib/site";

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

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fffaf6" },
    { media: "(prefers-color-scheme: dark)", color: "#16110e" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: site.title,
    template: "%s | Hestia Culinary Intelligence",
  },
  description: site.description,
  applicationName: site.name,
  authors: [{ name: site.author }],
  creator: site.creator,
  publisher: site.publisher,
  category: "Food Science & Culinary Technology",
  classification: "Culinary AI, Food Chemistry, Food Safety & Nutrition",
  referrer: "origin-when-cross-origin",
  keywords: site.keywords,
  alternates: {
    canonical: absoluteUrl("/home"),
    languages: {
      "en-US": absoluteUrl("/home"),
      "vi-VN": absoluteUrl("/home"),
      "x-default": absoluteUrl("/home"),
    },
  },
  icons: {
    icon: [
      { url: "/logo.png", type: "image/png", sizes: "1600x1600" },
      { url: "/logo-transparent.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/logo.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: ["/logo.png"],
  },
  manifest: "/manifest.webmanifest",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
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
    url: absoluteUrl("/home"),
    siteName: site.name,
    title: site.title,
    description: site.description,
    locale: site.locale,
    alternateLocale: ["vi_VN"],
    images: [
      {
        url: absoluteUrl("/hestia-hero.png"),
        alt: "Hestia culinary intelligence and evidence-based cooking",
        width: 1672,
        height: 941,
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: site.title,
    description: site.description,
    site: "@hestia_ai",
    creator: "@hestia_ai",
    images: [
      {
        url: absoluteUrl("/hestia-hero.png"),
        alt: "Hestia culinary intelligence",
      },
    ],
  },
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? {
        google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
      }
    : undefined,
};

const rootStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    getOrganizationSchema(),
    getWebSiteSchema(),
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* Resource Preconnect for Core Web Vitals Optimization */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://foodb.ca" />
        <link rel="dns-prefetch" href="https://www.themealdb.com" />
        <link rel="dns-prefetch" href="https://lh3.googleusercontent.com" />
      </head>
      <body className={`${jakarta.variable} ${cormorant.variable}`}>
        <JsonLd data={rootStructuredData} />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
