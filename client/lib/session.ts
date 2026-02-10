import type { User } from "@shared/schema";

const STORAGE_KEY = "socialaid_session";
const LEGACY_STORAGE_KEY = "socialaid_user";

let cachedToken: string | null = null;

/**
 * Prefer authenticating via HttpOnly cookie. The token cache is kept only
 * for backwards-compatibility with older sessions that still relied on the
 * Authorization header.
 */
export function getSessionToken(): string | undefined {
  if (cachedToken) return cachedToken;
  // Ne plus relire le token depuis localStorage pour les nouvelles sessions.
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

