import "dotenv/config";
import express, { RequestHandler } from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { handleLogin, handleGetUsers } from "./routes/auth";
import {
  handleGetFamilies,
  handleGetFamily,
  handleCreateFamily,
  handleUpdateFamily,
  handleDeleteFamily,
} from "./routes/families";
import { handleGetChildren, handleCreateChild, handleUpdateChild, handleDeleteChild } from "./routes/children";
import { handleGetNeeds, handleGetNeedsByFamily, handleCreateNeed, handleUpdateNeed, handleDeleteNeed } from "./routes/needs";
import { handleGetAids, handleGetAidsByFamily, handleCreateAid } from "./routes/aids";
import { handleGetNotes, handleCreateNote } from "./routes/notes";
import { handleGetDashboardStats, handleGetExportData } from "./routes/dashboard";
import { handleGetCategories, handleCreateCategory, handleUpdateCategory, handleDeleteCategory } from "./routes/categories";
import { storage } from "./storage";

// ---------- Auth Middleware ----------

/**
 * Requires a valid user ID in the x-user-id header.
 * Attaches the user to res.locals.user.
 */
const requireAuth: RequestHandler = (req, res, next) => {
  const userId = req.headers["x-user-id"] as string | undefined;
  if (!userId) {
    res.status(401).json({ error: "Authentification requise" });
    return;
  }
  const user = storage.getUser(userId);
  if (!user) {
    res.status(401).json({ error: "Utilisateur invalide" });
    return;
  }
  res.locals.user = user;
  next();
};

/**
 * Requires the authenticated user to be an admin.
 * Must be used after requireAuth.
 */
const requireAdmin: RequestHandler = (_req, res, next) => {
  const user = res.locals.user;
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Accès réservé aux administrateurs" });
    return;
  }
  next();
};

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Legacy routes (public)
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });
  app.get("/api/demo", handleDemo);

  // Auth (public — login doesn't require auth)
  app.post("/api/auth/login", handleLogin);

  // Categories (public read, admin write)
  app.get("/api/categories", handleGetCategories);
  app.post("/api/categories", requireAuth, requireAdmin, handleCreateCategory);
  app.put("/api/categories/:id", requireAuth, requireAdmin, handleUpdateCategory);
  app.delete("/api/categories/:id", requireAuth, requireAdmin, handleDeleteCategory);

  // ----- Admin-only routes -----
  app.get("/api/users", requireAuth, requireAdmin, handleGetUsers);
  app.get("/api/export", requireAuth, requireAdmin, handleGetExportData);

  // Dashboard (authenticated)
  app.get("/api/dashboard/stats", requireAuth, handleGetDashboardStats);

  // Families (authenticated, delete = admin only)
  app.get("/api/families", requireAuth, handleGetFamilies);
  app.post("/api/families", requireAuth, handleCreateFamily);
  app.get("/api/families/:id", requireAuth, handleGetFamily);
  app.put("/api/families/:id", requireAuth, handleUpdateFamily);
  app.delete("/api/families/:id", requireAuth, requireAdmin, handleDeleteFamily);

  // Children (authenticated, delete = admin only)
  app.get("/api/families/:familyId/children", requireAuth, handleGetChildren);
  app.post("/api/families/:familyId/children", requireAuth, handleCreateChild);
  app.put("/api/children/:id", requireAuth, handleUpdateChild);
  app.delete("/api/children/:id", requireAuth, requireAdmin, handleDeleteChild);

  // Needs (authenticated, delete = admin only)
  app.get("/api/needs", requireAuth, handleGetNeeds);
  app.post("/api/needs", requireAuth, handleCreateNeed);
  app.put("/api/needs/:id", requireAuth, handleUpdateNeed);
  app.delete("/api/needs/:id", requireAuth, requireAdmin, handleDeleteNeed);
  app.get("/api/families/:familyId/needs", requireAuth, handleGetNeedsByFamily);

  // Aids (authenticated)
  app.get("/api/aids", requireAuth, handleGetAids);
  app.post("/api/aids", requireAuth, handleCreateAid);
  app.get("/api/families/:familyId/aids", requireAuth, handleGetAidsByFamily);

  // Visit Notes (authenticated)
  app.get("/api/families/:familyId/notes", requireAuth, handleGetNotes);
  app.post("/api/families/:familyId/notes", requireAuth, handleCreateNote);

  return app;
}
