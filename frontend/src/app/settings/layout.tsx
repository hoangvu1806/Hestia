import type { ReactNode } from "react";

import { privatePageMetadata as metadata } from "@/lib/site";

export { metadata };

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return children;
}
