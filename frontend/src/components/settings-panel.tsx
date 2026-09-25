"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "./auth-provider";

type Locale = "en" | "vi";
type Theme = "light" | "dark" | "system";

export function SettingsPanel() {
  const { user } = useAuth();
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("en");
  const [theme, setTheme] = useState<Theme>("system");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setLocale(localStorage.getItem("hestia-locale") === "vi" ? "vi" : "en");
      const stored = localStorage.getItem("hestia-theme");
      setTheme(stored === "dark" || stored === "light" ? stored : "system");
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  function save() {
    localStorage.setItem("hestia-locale", locale);
    document.documentElement.lang = locale;
    if (theme === "system") {
      localStorage.removeItem("hestia-theme");
      document.documentElement.dataset.theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } else {
      localStorage.setItem("hestia-theme", theme);
      document.documentElement.dataset.theme = theme;
    }
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  return <div className="settings-panel">
    <section><div><span>LANGUAGE</span><h2>Conversation language</h2><p>Changes Hestia’s interface and response language. The URL stays the same.</p></div><div className="segmented-control"><button className={locale === "en" ? "selected" : ""} onClick={() => setLocale("en")} type="button">English</button><button className={locale === "vi" ? "selected" : ""} onClick={() => setLocale("vi")} type="button">Tiếng Việt</button></div></section>
    <section><div><span>APPEARANCE</span><h2>Color theme</h2><p>Choose a theme or follow your operating system.</p></div><div className="theme-options">{(["light", "dark", "system"] as Theme[]).map((value) => <button className={theme === value ? `theme-choice ${value} selected` : `theme-choice ${value}`} key={value} onClick={() => setTheme(value)} type="button"><i /><strong>{value[0].toUpperCase() + value.slice(1)}</strong></button>)}</div></section>
    <section><div><span>ACCOUNT & DATA</span><h2>{user ? user.displayName || "Your Google account" : "Sign in to Hestia"}</h2><p>{user ? "Conversation history is stored in PostgreSQL and isolated using your verified Firebase UID." : "Sign in with Google to create and revisit private conversations."}</p></div>{user ? <div className="account-setting">{user.photoURL ? <Image alt="" height={40} src={user.photoURL} unoptimized width={40} /> : <i>{(user.displayName || user.email || "H").slice(0, 1).toUpperCase()}</i>}<span><strong>{user.displayName || "Google account"}</strong><small>{user.email}</small></span><b>Firebase verified</b></div> : <button className="site-cta small" onClick={() => router.push("/login")} type="button">Sign in</button>}</section>
    <div className="settings-save"><button className="site-cta dark" onClick={save} type="button">{saved ? "Preferences saved" : "Save preferences"}</button><small>Language applies when you next open the chatbot.</small></div>
  </div>;
}
