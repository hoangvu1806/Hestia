import type { Metadata } from "next";
import type { ReactNode } from "react";

import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  path: "/login",
  title: "Sign In — Access Your Hestia Culinary Workspace | Hestia",
  description:
    "Sign in to Hestia with Google to access persistent cooking conversations, saved recipes, ingredient scans, and food science notes.",
  keywords: ["Hestia login", "sign in culinary AI", "Hestia cooking workspace"],
  image: "/logo-transparent.png",
});

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
