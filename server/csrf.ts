import { randomBytes } from "node:crypto";
import type { RequestHandler, Response } from "express";

const COOKIE_NAME = "csrf_token";
const HEADER_NAME = "x-csrf-token";
const COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

const isProduction = process.env.NODE_ENV === "production";

export function generateCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

export function setCsrfCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: false, // Client must read it to send in header (double-submit)
    secure: isProduction,
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_MS,
    path: "/",
  });
}

/**
 * Validates CSRF token for mutating methods (POST, PUT, PATCH, DELETE).
 * Expects header X-CSRF-Token to match the csrf_token cookie.
 */
export const requireCsrf: RequestHandler = (req, res, next) => {
  const method = (req.method || "GET").toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    return next();
  }

  const cookieToken = (req as any).cookies?.[COOKIE_NAME];
  const headerToken = req.headers[HEADER_NAME] as string | undefined;

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    res.status(403).json({
      error: "Token de sécurité invalide ou manquant. Rechargez la page.",
    });
    return;
  }
  next();
};
