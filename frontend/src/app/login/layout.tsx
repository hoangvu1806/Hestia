import type { Metadata } from "next";
import type { ReactNode } from "react";

import { pageMetadata, privatePageMetadata } from "@/lib/site";

export const metadata: Metadata = {
  ...pageMetadata({
    path: "/login",
    title: "Sign In — Access Your Hestia Culinary Workspace | Hestia",
    description: "Sign in to access your private Hestia workspace.",
    image: "/logo-transparent.webp",
  }),
  robots: privatePageMetadata.robots,
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
