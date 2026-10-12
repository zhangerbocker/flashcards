"use client";

import { useState } from "react";
import { applyTheme, loadTheme, saveTheme, type Theme } from "@/lib/theme";

const NEXT: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<Theme, string> = { system: "System", light: "Light", dark: "Dark" };

const ICON_PATHS: Record<Theme, string> = {
  system: "M3 5h18v11H3zM8 20h8M12 16v4",
  light: "M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z",
  dark: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z",
};

/** Tab-bar button that cycles the theme System → Light → Dark; applied at once and remembered on this device. */
export function ThemeButton({ className }: { className: string }) {
  const [theme, setTheme] = useState<Theme>(() => loadTheme(window.localStorage));
  function cycle() {
    const next = NEXT[theme];
    saveTheme(window.localStorage, next);
    applyTheme(next);
    setTheme(next);
  }
  return (
    <button type="button" onClick={cycle} aria-label={`Theme: ${LABEL[theme]}. Tap to change`} className={className}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={ICON_PATHS[theme]} />
      </svg>
      {LABEL[theme]}
    </button>
  );
}
