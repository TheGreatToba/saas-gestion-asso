import { RequestHandler } from "express";
import { LoginSchema } from "../../shared/schema";
import { storage } from "../storage";
import { createAuthToken } from "../auth-token";

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
  res.json({ user: result.user, token });
};

export const handleGetUsers: RequestHandler = (_req, res) => {
  const users = storage.getAllUsers();
  res.json(users);
};
