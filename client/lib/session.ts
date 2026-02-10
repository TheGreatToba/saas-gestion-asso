import type { User } from "@shared/schema";

const STORAGE_KEY = "socialaid_session";
const LEGACY_STORAGE_KEY = "socialaid_user";

let cachedToken: string | null = null;

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

export function readSession(): { user?: User; token?: string } | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as { user?: User; token?: string };
  } catch {
    return null;
  }
}

export function writeSession(session: { user: User; token: string }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
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

