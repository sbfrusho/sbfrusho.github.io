/** Hash routing, e.g. #/projects/limiter. The token is never part of a URL. */
import { useSyncExternalStore } from "react";
import { fieldId, parsePath } from "./lib/paths";

function subscribe(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}
const getHash = () => location.hash.replace(/^#\/?/, "");

export function useRoute(): { screen: string; param?: string } {
  const hash = useSyncExternalStore(subscribe, getHash);
  const [screen, ...rest] = hash.split("/");
  return { screen: screen || "dashboard", param: rest.length ? decodeURIComponent(rest.join("/")) : undefined };
}

let pendingFocus: string | null = null;

export function navigate(route: string, focusPath?: string) {
  pendingFocus = focusPath ?? null;
  const next = `#/${route}`;
  if (location.hash === next) window.dispatchEvent(new HashChangeEvent("hashchange"));
  else location.hash = next;
  if (focusPath) tryFocus();
}

/** Screens render asynchronously after a route change, so this retries for a moment. */
function tryFocus(attempt = 0) {
  requestAnimationFrame(() => {
    if (!pendingFocus) return;
    const keys = parsePath(pendingFocus).map(String);
    // A chip or row error falls back to the closest enclosing field.
    for (let n = keys.length; n > 0; n--) {
      const el = document.getElementById(fieldId(keys.slice(0, n).join(".")));
      if (el) {
        pendingFocus = null;
        el.scrollIntoView({ block: "center" });
        el.focus();
        return;
      }
    }
    if (attempt < 20) tryFocus(attempt + 1);
    else pendingFocus = null;
  });
}
