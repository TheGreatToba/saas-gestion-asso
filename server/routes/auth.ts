import { RequestHandler } from "express";
import { LoginSchema, RegisterSchema } from "../../shared/schema";
import { storage } from "../storage";
import { createAuthToken } from "../auth-token";

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

  // Issue HttpOnly, SameSite cookie for the auth token.
  // Keep JSON token in body for backwards-compatibility with existing clients.
  res.cookie("auth_token", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    // 12h like DEFAULT_TTL_SECONDS; browser may evict earlier.
    maxAge: 1000 * 60 * 60 * 12,
  });

  res.json({ user: result.user, token });
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
    const user = storage.createUser({
      name: parsed.data.name,
      email: parsed.data.email,
      password: parsed.data.password,
      role: "admin",
      active: true,
    });
    const token = createAuthToken(user.id);
    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 12,
    });
    res.status(201).json({ user, token });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    res.status(400).json({ error: message });
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

export const handleGetUsers: RequestHandler = (_req, res) => {
  const users = storage.getAllUsers();
  res.json(users);
};
