import type { ReactNode } from "react";

import { PageScrollbar } from "./page-scrollbar";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

export function MarketingShell({ children }: { children: ReactNode }) {
  return <main className="marketing-site"><SiteHeader />{children}<SiteFooter /><PageScrollbar /></main>;
}
