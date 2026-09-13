"use client";

import type { Locale } from "@/i18n/config";

export function LocaleSwitcher({ label, locale }: { label: string; locale: Locale }) {
  const nextLocale: Locale = locale === "en" ? "vi" : "en";

  function switchLocale() {
    localStorage.setItem("hestia-locale", nextLocale);
  }

  return (
    <a
      aria-label={label}
      className="locale-button"
      href={`/${nextLocale}/`}
      onClick={switchLocale}
    >
      {nextLocale.toUpperCase()}
    </a>
  );
}
