import type { User } from "@shared/schema";

const STORAGE_KEY = "socialaid_session";
const LEGACY_STORAGE_KEY = "socialaid_user";

let cachedToken: string | null = null;

/**
 * Prefer reading the token from an in-memory cache populated during login.
 * For backwards-compatibility with older sessions, we still read from
 * localStorage, but new logins no longer persist the token there.
 */
export function getSessionToken(): string | undefined {
  if (cachedToken) return cachedToken;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return undefined;
    const session = JSON.parse(stored) as { token?: string };
    cachedToken = session?.token ?? null;
    return cachedToken ?? undefined;
  } catch {
    return undefined;
  }
}

export function setSessionToken(token: string | null) {
  cachedToken = token;
}

/**
 * Read session for UI purposes (user object). The token may be undefined if
 * the session comes from the HttpOnly cookie only.
 */
export function readSession(): { user?: User; token?: string } | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as { user?: User; token?: string };
  } catch {
    return null;
  }
}

/**
 * Persist only the user in localStorage; the token is now primarily stored in
 * an HttpOnly cookie on the server side, with an in-memory cache for the rare
 * cases where Authorization header is still used.
 */
export function writeSession(session: { user: User; token: string }) {
  try {
    cachedToken = session.token;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ user: session.user }),
    );
  } catch {
    // ignore storage errors (private mode, quota, etc.)
  }
}

export function clearSession() {
  cachedToken = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // ignore
  }
}

