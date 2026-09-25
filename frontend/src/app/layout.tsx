import type { Metadata } from "next";
import { Cormorant_Garamond, Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";

import "katex/dist/katex.min.css";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";

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

export const metadata: Metadata = {
  title: { default: "Hestia — Cook with evidence", template: "%s — Hestia" },
  description: "Food intelligence that connects ingredients, chemistry, safety, and practical cooking.",
  icons: { icon: "/logo.png", apple: "/logo.png" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className={`${jakarta.variable} ${cormorant.variable}`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
