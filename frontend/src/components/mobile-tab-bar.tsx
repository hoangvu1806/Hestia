"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "./icons";

const tabs = [
  { href: "/", icon: "home", label: "Home" },
  { href: "/chat/", icon: "chat", label: "Ask" },
  { href: "/ingredients/", icon: "ingredients", label: "Library" },
  { href: "/science/", icon: "chemistry", label: "Science" },
  { href: "/settings/", icon: "settings", label: "Settings" },
] as const;

const HIDDEN_ON = ["/login"];

function normalize(path: string) {
  return path.endsWith("/") ? path : `${path}/`;
}

export function MobileTabBar() {
  const pathname = normalize(usePathname() || "/");
  if (HIDDEN_ON.some((prefix) => pathname.startsWith(prefix))) return null;

  return (
    <nav aria-label="Primary" className="mobile-tabbar">
      {tabs.map((tab) => {
        const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={active ? "active" : undefined}
            href={tab.href}
            key={tab.href}
          >
            <span className="mobile-tabbar-icon">
              <Icon height={22} name={tab.icon} width={22} />
            </span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
