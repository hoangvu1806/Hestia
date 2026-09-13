"use client";

import { Icon } from "./icons";

type Theme = "light" | "dark";

export function ThemeToggle({ label }: { label: string }) {
  function toggleTheme() {
    const current: Theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    const next: Theme = current === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("hestia-theme", next);
  }

  return (
    <button aria-label={label} className="icon-button" onClick={toggleTheme} type="button">
      <Icon className="theme-light-icon" height={19} name="moon" width={19} />
      <Icon className="theme-dark-icon" height={19} name="sun" width={19} />
    </button>
  );
}
