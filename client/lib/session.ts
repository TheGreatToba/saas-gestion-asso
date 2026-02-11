import type { User } from "@shared/schema";

const STORAGE_KEY = "socialaid_session";
const LEGACY_STORAGE_KEY = "socialaid_user";

let cachedToken: string | null = null;

/**
 * Prefer authenticating via HttpOnly cookie. Falls back to localStorage token
 * for Authorization header when cookie is not sent (e.g. localhost vs 127.0.0.1,
 * browser settings) so the session persists across refresh.
 */
export function getSessionToken(): string | undefined {
  if (cachedToken) return cachedToken;
  const session = readSession();
  if (session?.token) {
    cachedToken = session.token;
    return session.token;
  }
  return undefined;
}

export function setSessionToken(token: string | null) {
  cachedToken = token;
}

/**
 * Read session for UI purposes (user object).
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
 * Persist user and token in localStorage. The token is primarily in an HttpOnly
 * cookie, but we also store it so Authorization header can be used as fallback
 * on refresh (when cookie may not be sent, e.g. localhost vs 127.0.0.1).
 */
export function writeSession(session: { user: User; token: string }) {
  try {
    cachedToken = session.token;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ user: session.user, token: session.token }),
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

