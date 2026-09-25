"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AppShell } from "./app-shell";
import { useAuth } from "./auth-provider";

import en from "@/i18n/locales/en.json";
import vi from "@/i18n/locales/vi.json";

export function ChatClient() {
  const [locale, setLocale] = useState<"en" | "vi">("en");
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);
  const { loading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setLocale(localStorage.getItem("hestia-locale") === "vi" ? "vi" : "en");
      setInitialPrompt(new URLSearchParams(window.location.search).get("prompt") || "");
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      const next = `${window.location.pathname}${window.location.search}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [loading, router, user]);

  if (loading || !user || initialPrompt === null) {
    return <main className="auth-loading"><div className="auth-loader"><span /><strong>Opening your kitchen workspace…</strong></div></main>;
  }

  return <AppShell dictionary={locale === "vi" ? vi : en} initialPrompt={initialPrompt} />;
}
