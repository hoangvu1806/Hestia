import type { ReactNode } from "react";

import { privatePageMetadata as metadata } from "@/lib/site";

export { metadata };

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
