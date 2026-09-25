import { MarketingShell } from "@/components/marketing-shell";
import { SectionHero } from "@/components/section-hero";
import { SettingsPanel } from "@/components/settings-panel";

export default function SettingsPage() {
  return <MarketingShell><SectionHero eyebrow="Settings" title="Make Hestia feel at home." copy="Control language and appearance in one place. Preferences follow this browser, not the URL." /><section className="site-container"><SettingsPanel /></section></MarketingShell>;
}
