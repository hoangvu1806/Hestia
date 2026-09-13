import "server-only";

import type { Locale } from "./config";

const dictionaries = {
  en: () => import("./locales/en.json").then((module) => module.default),
  vi: () => import("./locales/vi.json").then((module) => module.default),
};

export type Dictionary = Awaited<ReturnType<(typeof dictionaries)[Locale]>>;

export function getDictionary(locale: Locale) {
  return dictionaries[locale]();
}
