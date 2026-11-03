/** Same convention as the public site: localStorage "theme" + <html data-theme>. Absent = follow the OS. */
import { THEME_KEY } from "./config";

export type ThemeMode = "system" | "light" | "dark";
export const THEME_ORDER: ThemeMode[] = ["system", "light", "dark"];

export function storedTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", mode);
  try {
    if (mode === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, mode);
  } catch {
    /* the choice still applies to this page view */
  }
}
