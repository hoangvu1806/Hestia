"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Brand } from "./brand";
import { ThemeToggle } from "./theme-toggle";
import { useAuth } from "./auth-provider";

const links = [
  ["Home", "/home"],
  ["Ask Hestia", "/chat"],
  ["Food science", "/science"],
  ["Ingredients", "/ingredients"],
  ["Download", "/download"],
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const account = useRef<HTMLDivElement>(null);
  const { loading, signInWithGoogle, signOut, user } = useAuth();

  useEffect(() => {
    function closeAccount(event: PointerEvent) {
      if (!account.current?.contains(event.target as Node)) setAccountOpen(false);
    }
    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setAccountOpen(false);
    }
    window.addEventListener("pointerdown", closeAccount);
    window.addEventListener("keydown", closeWithEscape);
    return () => {
      window.removeEventListener("pointerdown", closeAccount);
      window.removeEventListener("keydown", closeWithEscape);
    };
  }, []);

  async function signIn() {
    setSigningIn(true);
    setAuthError("");
    try {
      await signInWithGoogle();
    } catch (reason) {
      const code = typeof reason === "object" && reason && "code" in reason
        ? String(reason.code)
        : "";
      if (code !== "auth/popup-closed-by-user") setAuthError("Google sign-in failed. Try again.");
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <header className="site-header">
      <Link aria-label="Hestia home" className="site-brand-link" href="/home">
        <Brand name="Hestia" tagline="Culinary intelligence" />
      </Link>
      <button
        aria-expanded={open}
        aria-label="Toggle navigation"
        className="site-menu-button"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span /><span />
      </button>
      <nav className={open ? "site-nav open" : "site-nav"}>
        {links.map(([label, href]) => (
          <Link
            className={pathname === href ? "active" : ""}
            href={href}
            key={href}
            onClick={() => setOpen(false)}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="site-actions">
        <ThemeToggle label="Change color theme" />
        {user ? <div className="site-account" ref={account}>
          <button
            aria-expanded={accountOpen}
            aria-haspopup="menu"
            aria-label="Open your Hestia account"
            className="header-account"
            onClick={() => setAccountOpen((current) => !current)}
            type="button"
          >
            {user.photoURL ? (
              <Image alt="" className="header-account-photo" height={40} src={user.photoURL} unoptimized width={40} />
            ) : (
              <span className="header-account-avatar">{(user.displayName || user.email || "H").slice(0, 1).toUpperCase()}</span>
            )}
          </button>
          {accountOpen ? <div aria-label="Account menu" className="account-popover" role="menu">
            <div className="account-popover-identity">
              {user.photoURL ? <Image alt="" height={42} src={user.photoURL} unoptimized width={42} /> : <span>{(user.displayName || user.email || "H").slice(0, 1).toUpperCase()}</span>}
              <div><small>Signed in as</small><strong>{user.displayName || "Your account"}</strong><small>{user.email}</small></div>
            </div>
            <Link href="/chat" onClick={() => setAccountOpen(false)} role="menuitem"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 4v-4A1.5 1.5 0 0 1 4 14.5v-9Z" /></svg><span>Open workspace</span><b>↗</b></Link>
            <button className="account-sign-out" onClick={() => void signOut().then(() => setAccountOpen(false))} role="menuitem" type="button"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10M14.5 8.5 18 12l-3.5 3.5M18 12H9" /></svg><span>Sign out</span><b>→</b></button>
          </div> : null}
        </div> : <button
          aria-label="Sign in with Google"
          className="header-sign-in"
          disabled={loading || signingIn}
          onClick={() => void signIn()}
          type="button"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.3c1.9-1.8 2.9-4.4 2.9-7.4Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.5c-.9.6-2.1 1-3.4 1a5.9 5.9 0 0 1-5.5-4.1H3.1v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.5 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9.1L6.5 14Z"/><path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.9 1.5l2.9-2.8A9.7 9.7 0 0 0 3.1 7.5l3.4 2.6A5.9 5.9 0 0 1 12 6Z"/></svg>
          <span className="site-account-copy">{loading ? "Checking…" : signingIn ? "Opening Google…" : "Sign in"}</span>
        </button>}
        {authError ? <span className="header-auth-error" role="alert">{authError}</span> : null}
      </div>
    </header>
  );
}
