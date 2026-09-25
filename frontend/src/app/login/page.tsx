"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/components/auth-provider";

export default function LoginPage() {
  const { loading, signInWithGoogle, user } = useAuth();
  const [error, setError] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [destination, setDestination] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const requested = new URLSearchParams(window.location.search).get("next") || "/chat";
      setDestination(
        requested.startsWith("/") && !requested.startsWith("//") ? requested : "/chat",
      );
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!loading && user && destination) router.replace(destination);
  }, [destination, loading, router, user]);

  async function signIn() {
    setSigningIn(true);
    setError("");
    try {
      await signInWithGoogle();
      router.replace(destination || "/chat");
    } catch (reason) {
      const code = typeof reason === "object" && reason && "code" in reason ? String(reason.code) : "";
      if (code !== "auth/popup-closed-by-user") {
        setError("Google sign-in could not be completed. Check the authorized domain and try again.");
      }
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <main className="login-page">
      <header className="login-header">
        <Link href="/home"><Brand name="Hestia" tagline="Culinary intelligence" /></Link>
        <ThemeToggle label="Change color theme" />
      </header>
      <section className="login-visual" aria-label="Hestia culinary workspace preview">
        <Image alt="Fresh ingredients arranged for evidence-led cooking" fill priority sizes="(max-width: 800px) 100vw, 54vw" src="/hestia-hero.png" />
        <div className="login-visual-copy">
          <span>YOUR PRIVATE KITCHEN NOTEBOOK</span>
          <h1>Good cooking starts with a question worth keeping.</h1>
          <p>Your conversations, ingredient photos, and culinary investigations stay organized under your account.</p>
        </div>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <div className="account-seal" aria-hidden="true"><Image alt="" height={52} src="/logo-transparent.png" width={52} /></div>
          <span className="eyebrow">Welcome to Hestia</span>
          <h2>Continue to your culinary workspace</h2>
          <p>Sign in once to keep every conversation private, available, and ready to continue.</p>
          <button className="google-sign-in" disabled={loading || signingIn} onClick={() => void signIn()} type="button">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.3c1.9-1.8 2.9-4.4 2.9-7.4Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.5c-.9.6-2.1 1-3.4 1a5.9 5.9 0 0 1-5.5-4.1H3.1v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.5 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9.1L6.5 14Z"/><path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.9 1.5l2.9-2.8A9.7 9.7 0 0 0 3.1 7.5l3.4 2.6A5.9 5.9 0 0 1 12 6Z"/></svg>
            {signingIn ? "Opening Google…" : "Continue with Google"}
          </button>
          {error ? <p className="login-error" role="alert">{error}</p> : null}
          <div className="login-assurance"><i /> Protected by Firebase Authentication</div>
          <small>By continuing, you agree to use Hestia responsibly and verify critical food-safety guidance.</small>
        </div>
      </section>
    </main>
  );
}
