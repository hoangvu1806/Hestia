import { Brand } from "./brand";
import { LocaleSwitcher } from "./locale-switcher";
import { ThemeToggle } from "./theme-toggle";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

type AuthScreenProps = {
  dictionary: Dictionary;
  error: string | null;
  loading?: boolean;
  locale: Locale;
  onSignIn: () => void;
};

export function AuthScreen({ dictionary, error, loading, locale, onSignIn }: AuthScreenProps) {
  const { auth, brand, header } = dictionary;

  return (
    <main className="auth-page">
      <div className="auth-ambient auth-ambient-one" />
      <div className="auth-ambient auth-ambient-two" />
      <header className="auth-header">
        <Brand name={brand.name} tagline={brand.tagline} />
        <div className="header-actions">
          <LocaleSwitcher label={header.language} locale={locale} />
          <ThemeToggle label={header.theme} />
        </div>
      </header>
      <section className="auth-card" aria-labelledby="auth-title">
        <span className="auth-kicker">{auth.kicker}</span>
        <h1 id="auth-title">{auth.title}</h1>
        <p>{auth.description}</p>
        <button className="google-sign-in" disabled={loading} onClick={onSignIn} type="button">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z" fill="#4285F4" />
            <path d="M12 22c2.7 0 4.98-.9 6.63-2.36l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z" fill="#34A853" />
            <path d="M6.39 13.93A6.02 6.02 0 0 1 6.07 12c0-.67.11-1.32.32-1.93V7.45H3.04A10 10 0 0 0 2 12c0 1.63.39 3.17 1.04 4.55l3.35-2.62Z" fill="#FBBC05" />
            <path d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.88A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z" fill="#EA4335" />
          </svg>
          <span>{loading ? auth.signingIn : auth.googleSignIn}</span>
        </button>
        {error ? <p className="auth-error" role="alert">{error}</p> : null}
        <small>{auth.privacy}</small>
      </section>
    </main>
  );
}
