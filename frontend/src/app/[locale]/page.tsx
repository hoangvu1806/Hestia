import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";

type HomeProps = {
  params: Promise<{ locale: string }>;
};

export default async function Home({ params }: HomeProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dictionary = await getDictionary(locale);

  return <AppShell dictionary={dictionary} locale={locale} />;
}
