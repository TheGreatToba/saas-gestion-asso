import type { User } from "@shared/schema";

const STORAGE_KEY = "socialaid_session";
const LEGACY_STORAGE_KEY = "socialaid_user";

/**
 * Session is stored for UI only (user display). Auth is cookie-only; no token in localStorage.
 */
export function readSession(): { user?: User } | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as { user?: User; token?: string };
    return { user: parsed.user };
  } catch {
    return null;
  }
}

export function writeSession(session: { user: User }) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ user: session.user }),
    );
  } catch {
    // ignore storage errors (private mode, quota, etc.)
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** @deprecated Auth is cookie-only; no token stored. Kept for API compatibility. */
export function getSessionToken(): string | undefined {
  return undefined;
}

/** @deprecated No-op. Kept for API compatibility. */
export function setSessionToken(_token: string | null) {}
