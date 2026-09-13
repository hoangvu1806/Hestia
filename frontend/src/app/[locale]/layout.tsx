import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";

import "katex/dist/katex.min.css";
import "../globals.css";

import { getDictionary } from "@/i18n/dictionaries";
import { isLocale, locales } from "@/i18n/config";

const themeScript = `(() => { try { const saved = localStorage.getItem('hestia-theme'); const systemDark = matchMedia('(prefers-color-scheme: dark)').matches; document.documentElement.dataset.theme = saved || (systemDark ? 'dark' : 'light'); } catch (_) {} })();`;

const plusJakarta = Plus_Jakarta_Sans({
  display: "swap",
  subsets: ["latin", "vietnamese"],
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700", "800"],
});

type LocaleLayoutProps = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: LocaleLayoutProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dictionary = await getDictionary(locale);
  return {
    title: dictionary.meta.title,
    description: dictionary.meta.description,
    icons: { icon: "/logo.png", apple: "/logo.png" },
  };
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className={plusJakarta.variable}>{children}</body>
    </html>
  );
}
