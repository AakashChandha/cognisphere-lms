/**
 * Centralized access to persisted auth tokens. Uses `localStorage` per the
 * project's auth-storage decision (documented in the architecture notes).
 * Kept in one place so the storage mechanism (e.g. httpOnly cookies) could be
 * swapped later without touching call sites.
 */

const ACCESS_TOKEN_KEY = "lms.accessToken";
const REFRESH_TOKEN_KEY = "lms.refreshToken";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export const tokenStorage = {
  getAccessToken(): string | null {
    if (!isBrowser()) return null;
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  getRefreshToken(): string | null {
    if (!isBrowser()) return null;
    return window.localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  setTokens(accessToken: string, refreshToken: string): void {
    if (!isBrowser()) return;
    window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },
  setAccessToken(accessToken: string): void {
    if (!isBrowser()) return;
    window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  },
  clear(): void {
    if (!isBrowser()) return;
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};
