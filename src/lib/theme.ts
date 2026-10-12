import type { KeyValueStorage } from "./progress-store";

export type Theme = "system" | "light" | "dark";

export const THEME_KEY = "hsk.theme.v1";

export function loadTheme(storage: KeyValueStorage): Theme {
  const value = storage.getItem(THEME_KEY);
  return value === "light" || value === "dark" ? value : "system";
}

export function saveTheme(storage: KeyValueStorage, theme: Theme): void {
  storage.setItem(THEME_KEY, theme);
}

/** Whether the page should be dark for a theme, given the system preference. */
export function isDark(theme: Theme, systemPrefersDark: boolean): boolean {
  return theme === "dark" || (theme === "system" && systemPrefersDark);
}

/** Applies a theme to the document by toggling the `dark` class on <html>. */
export function applyTheme(theme: Theme): void {
  const dark = isDark(theme, window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

/**
 * Inline script run before the first paint (see layout.tsx): applies the saved
 * theme so a dark page never flashes light, and follows system changes while
 * the theme is "system". Mirrors loadTheme/isDark; keep them in sync.
 */
export const THEME_BOOT_SCRIPT = `(() => {
  const key = ${JSON.stringify(THEME_KEY)};
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const apply = () => {
    let theme = "system";
    try { theme = localStorage.getItem(key) || "system"; } catch {}
    const dark = theme === "dark" || (theme !== "light" && media.matches);
    document.documentElement.classList.toggle("dark", dark);
  };
  apply();
  media.addEventListener("change", apply);
})();`;
