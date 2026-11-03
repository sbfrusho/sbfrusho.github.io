/** Token storage. Memory + sessionStorage by default; localStorage only when the owner opts in. */
const KEY = "admin.gh.token";

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function loadToken(): { token: string; remembered: boolean } | null {
  const session = safe(() => sessionStorage.getItem(KEY), null);
  if (session) return { token: session, remembered: false };
  const local = safe(() => localStorage.getItem(KEY), null);
  return local ? { token: local, remembered: true } : null;
}

export function saveToken(token: string, remember: boolean): void {
  clearToken();
  safe(() => (remember ? localStorage : sessionStorage).setItem(KEY, token), undefined);
}

export function clearToken(): void {
  safe(() => sessionStorage.removeItem(KEY), undefined);
  safe(() => localStorage.removeItem(KEY), undefined);
}
