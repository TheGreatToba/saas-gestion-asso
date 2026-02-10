import { createHmac, timingSafeEqual } from "node:crypto";

interface AuthTokenPayload {
  userId: string;
  exp: number;
}

const DEFAULT_TTL_SECONDS = 60 * 60 * 12; // 12h

// Resolve secret at module load so a missing secret fails fast in production.
const AUTH_SECRET: string | null =
  process.env.AUTH_SECRET ??
  (process.env.NODE_ENV === "production"
    ? null
    : "dev-insecure-secret-change-me");

if (!AUTH_SECRET) {
  throw new Error(
    "AUTH_SECRET must be defined in the environment (no fallback allowed in production).",
  );
}

function getSecret(): string {
  return AUTH_SECRET!;
}

function toBase64Url(input: string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromBase64Url(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  return Buffer.from(base64 + padding, "base64").toString("utf8");
}

function sign(input: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(input)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function createAuthToken(
  userId: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): string {
  const payload: AuthTokenPayload = {
    userId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const payloadPart = toBase64Url(JSON.stringify(payload));
  const signaturePart = sign(payloadPart, getSecret());
  return `${payloadPart}.${signaturePart}`;
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  const [payloadPart, signaturePart] = token.split(".");
  if (!payloadPart || !signaturePart) return null;

  const expected = sign(payloadPart, getSecret());
  const providedBuffer = Buffer.from(signaturePart);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return null;
  const isValidSignature = timingSafeEqual(providedBuffer, expectedBuffer);
  if (!isValidSignature) return null;

  try {
    const payload = JSON.parse(fromBase64Url(payloadPart)) as AuthTokenPayload;
    if (!payload.userId || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
