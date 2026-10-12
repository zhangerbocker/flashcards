import { describe, expect, it } from "vitest";
import { isDark, loadTheme, saveTheme } from "./theme";

class MemoryStorage {
  private items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

describe("theme", () => {
  it("defaults to following the system", () => {
    expect(loadTheme(new MemoryStorage())).toBe("system");
  });

  it("round-trips a saved theme and ignores unknown values", () => {
    const storage = new MemoryStorage();
    saveTheme(storage, "dark");
    expect(loadTheme(storage)).toBe("dark");
    storage.setItem("hsk.theme.v1", "purple");
    expect(loadTheme(storage)).toBe("system");
  });

  it("resolves dark mode from the theme and the system preference", () => {
    expect(isDark("dark", false)).toBe(true);
    expect(isDark("light", true)).toBe(false);
    expect(isDark("system", true)).toBe(true);
    expect(isDark("system", false)).toBe(false);
  });
});
