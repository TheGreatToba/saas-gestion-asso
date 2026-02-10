import "dotenv/config";
import express, { RequestHandler } from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { handleLogin, handleGetUsers } from "./routes/auth";
import { handleCreateUser, handleUpdateUser } from "./routes/users";
import {
  handleGetFamilies,
  handleGetFamily,
  handleCreateFamily,
  handleUpdateFamily,
  handleDeleteFamily,
} from "./routes/families";
import {
  handleGetChildren,
  handleCreateChild,
  handleUpdateChild,
  handleDeleteChild,
} from "./routes/children";
import {
  handleGetNeeds,
  handleGetNeedsByFamily,
  handleCreateNeed,
  handleUpdateNeed,
  handleDeleteNeed,
} from "./routes/needs";
import {
  handleGetAids,
  handleGetAidsByFamily,
  handleCreateAid,
} from "./routes/aids";
import { handleGetNotes, handleCreateNote } from "./routes/notes";
import {
  handleGetDashboardStats,
  handleGetExportData,
} from "./routes/dashboard";
import {
  handleGetCategories,
  handleCreateCategory,
  handleUpdateCategory,
  handleDeleteCategory,
} from "./routes/categories";
import {
  handleGetAllArticles,
  handleGetArticlesByCategory,
  handleCreateArticle,
  handleUpdateArticle,
  handleDeleteArticle,
  handleAdjustArticleStock,
} from "./routes/articles";
import { handleSearch } from "./routes/search";
import { handleGetAuditLogs } from "./routes/audit";
import { handleImportFamilies } from "./routes/import";
import {
  handleGetFamilyDocuments,
  handleCreateFamilyDocument,
  handleDeleteFamilyDocument,
} from "./routes/documents";
import { storage } from "./storage";
import { verifyAuthToken } from "./auth-token";

// ---------- Auth Middleware ----------

/**
 * Requires a valid bearer token in Authorization header.
 * Attaches the user to res.locals.user.
 */
const requireAuth: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    res.status(401).json({ error: "Authentification requise" });
    return;
  }

  const payload = verifyAuthToken(token);
  if (!payload) {
    res.status(401).json({ error: "Session invalide ou expirée" });
    return;
  }

  const user = storage.getUser(payload.userId);
  if (!user) {
    res.status(401).json({ error: "Utilisateur invalide" });
    return;
  }
  if (!user.active) {
    res.status(403).json({ error: "Compte désactivé" });
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
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

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
  app.put(
    "/api/categories/:id",
    requireAuth,
    requireAdmin,
    handleUpdateCategory,
  );
  app.delete(
    "/api/categories/:id",
    requireAuth,
    requireAdmin,
    handleDeleteCategory,
  );

  // Articles (public read, admin write)
  app.get("/api/articles", handleGetAllArticles);
  app.get("/api/categories/:categoryId/articles", handleGetArticlesByCategory);
  app.post("/api/articles", requireAuth, requireAdmin, handleCreateArticle);
  app.put("/api/articles/:id", requireAuth, requireAdmin, handleUpdateArticle);
  app.delete(
    "/api/articles/:id",
    requireAuth,
    requireAdmin,
    handleDeleteArticle,
  );
  app.patch(
    "/api/articles/:id/stock",
    requireAuth,
    requireAdmin,
    handleAdjustArticleStock,
  );

  // ----- Admin-only routes -----
  app.get("/api/users", requireAuth, requireAdmin, handleGetUsers);
  app.post("/api/users", requireAuth, requireAdmin, handleCreateUser);
  app.patch("/api/users/:id", requireAuth, requireAdmin, handleUpdateUser);
  app.get("/api/export", requireAuth, requireAdmin, handleGetExportData);
  app.get("/api/audit-logs", requireAuth, requireAdmin, handleGetAuditLogs);
  app.post("/api/import/families", requireAuth, requireAdmin, handleImportFamilies);

  // Dashboard (authenticated)
  app.get("/api/dashboard/stats", requireAuth, handleGetDashboardStats);

  // Global search (authenticated)
  app.get("/api/search", requireAuth, handleSearch);

  // Families (authenticated, delete = admin only)
  app.get("/api/families", requireAuth, handleGetFamilies);
  app.post("/api/families", requireAuth, handleCreateFamily);
  app.get("/api/families/:id", requireAuth, handleGetFamily);
  app.put("/api/families/:id", requireAuth, handleUpdateFamily);
  app.delete(
    "/api/families/:id",
    requireAuth,
    requireAdmin,
    handleDeleteFamily,
  );

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

  // Family Documents (authenticated)
  app.get(
    "/api/families/:familyId/documents",
    requireAuth,
    handleGetFamilyDocuments,
  );
  app.post(
    "/api/families/:familyId/documents",
    requireAuth,
    handleCreateFamilyDocument,
  );
  app.delete(
    "/api/families/:familyId/documents/:documentId",
    requireAuth,
    handleDeleteFamilyDocument,
  );

  // Error handler
  app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(
      `[${new Date().toISOString()}] ${req.method} ${req.url}`,
      err,
    );
    res.status(500).json({ error: "Erreur serveur" });
  });

  return app;
}
