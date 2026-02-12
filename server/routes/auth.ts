import { RequestHandler } from "express";
import { LoginSchema, RegisterSchema } from "../../shared/schema";
import { storage } from "../storage";
import { createAuthToken } from "../auth-token";
import { generateCsrfToken, setCsrfCookie } from "../csrf";

const isProduction = process.env.NODE_ENV === "production";

export const handleLogin: RequestHandler = (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Données invalides", details: parsed.error.flatten() });
    return;
  }

  const result = storage.authenticate(parsed.data.email, parsed.data.password);
  if (!result.user) {
    if (result.error === "disabled") {
      res.status(403).json({ error: "Compte désactivé" });
      return;
    }
    res.status(401).json({ error: "Email ou mot de passe incorrect" });
    return;
  }

  const token = createAuthToken(result.user.id);

  res.cookie("auth_token", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 12,
  });

  const csrfToken = generateCsrfToken();
  setCsrfCookie(res, csrfToken);

  res.json({ user: result.user });
};

export const handleRegister: RequestHandler = (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Données invalides", details: parsed.error.flatten() });
    return;
  }
  try {
    const user = storage.createUser(
      {
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password,
        role: "volunteer",
        active: false,
      },
      "org-default",
    );
    res.status(201).json({ user, pending: true });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Erreur serveur";
    console.error("[auth/register]", err);
    // Ne pas exposer les erreurs techniques (ex. better-sqlite3 bindings) au client
    const isTechnical = /bindings|sqlite|node\.node|ENOENT/i.test(raw);
    res.status(400).json({
      error: isTechnical ? "Service temporairement indisponible. Réessayez plus tard ou contactez l’administrateur." : raw,
    });
  }
};

export const handleMe: RequestHandler = (_req, res) => {
  const user = (res as any).locals?.user;
  if (!user) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  res.json({ user });
};

export const handleLogout: RequestHandler = (_req, res) => {
  // Supprime le cookie côté client en le remplaçant par un cookie expiré.
  res.cookie("auth_token", "", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 0,
  });
  res.status(204).send();
};

export const handleGetUsers: RequestHandler = (req, res) => {
  const user = (res as any).locals?.user as { organizationId: string } | undefined;
  const orgId = user?.organizationId ?? "org-default";
  const users = storage.getAllUsers(orgId);
  res.json(users);
};
