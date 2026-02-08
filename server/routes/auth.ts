import { RequestHandler } from "express";
import { LoginSchema } from "../../shared/schema";
import { storage } from "../storage";

export const handleLogin: RequestHandler = (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides", details: parsed.error.flatten() });
    return;
  }

  const user = storage.authenticate(parsed.data.email, parsed.data.password);
  if (!user) {
    res.status(401).json({ error: "Email ou mot de passe incorrect" });
    return;
  }

  res.json({ user });
};

export const handleGetUsers: RequestHandler = (_req, res) => {
  const users = storage.getAllUsers();
  res.json(users);
};
