import "dotenv/config";
import express, { RequestHandler } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { handleDemo } from "./routes/demo";
import { handleLogin, handleGetUsers, handleLogout, handleMe } from "./routes/auth";
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
  handleGetFamilyDocumentDownloadUrl,
} from "./routes/documents";
import { storage } from "./storage";
import { verifyAuthToken } from "./auth-token";
import { rateLimitLogin } from "./rate-limit";

const isProduction = process.env.NODE_ENV === "production";

// ---------- Auth Middleware ----------

/**
 * Requires a valid auth token, either from Authorization header (Bearer)
 * or from the "auth_token" cookie. Attaches the user to res.locals.user.
 */
const requireAuth: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  const headerToken = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  // Prefer header token if present (for backwards-compatibility during migration)
  const cookieToken =
    (req as any).cookies?.auth_token ?? (req as any).signedCookies?.auth_token;
  const token = headerToken ?? cookieToken;
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
  const allowedOriginsEnv = process.env.CORS_ORIGINS;
  const allowedOrigins = allowedOriginsEnv
    ? allowedOriginsEnv
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean)
    : ["http://localhost:5173", "http://127.0.0.1:5173"];

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) {
          // Allow non-browser clients / same-origin
          return callback(null, true);
        }
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        if (!isProduction) {
          // In non-production, log but allow for easier local testing
          console.warn(
            `[CORS] Requête depuis une origine non autorisée: ${origin}`,
          );
          return callback(null, true);
        }
        console.error(
          `[CORS] Origine refusée: "${origin}". Autorisées: ${JSON.stringify(allowedOrigins)}`,
        );
        return callback(new Error("Origine non autorisée par CORS"));
      },
    }),
  );
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app.use(cookieParser());

  // Health check (for load balancers)
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // Legacy routes (public)
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });
  app.get("/api/demo", handleDemo);

  // Auth (public — login doesn't require auth)
  app.post("/api/auth/login", rateLimitLogin, handleLogin);
  app.get("/api/auth/me", requireAuth, handleMe);
  app.post("/api/auth/logout", requireAuth, handleLogout);

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

  // Family Documents (admin only - documents souvent sensibles)
  app.get(
    "/api/families/:familyId/documents",
    requireAuth,
    requireAdmin,
    handleGetFamilyDocuments,
  );
  app.post(
    "/api/families/:familyId/documents",
    requireAuth,
    requireAdmin,
    handleCreateFamilyDocument,
  );
  app.delete(
    "/api/families/:familyId/documents/:documentId",
    requireAuth,
    requireAdmin,
    handleDeleteFamilyDocument,
  );
  app.get(
    "/api/families/:familyId/documents/:documentId/download",
    requireAuth,
    requireAdmin,
    handleGetFamilyDocumentDownloadUrl,
  );

  // Error handler
  app.use(
    (
      err: unknown,
      req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error(
        `[${new Date().toISOString()}] ${req.method} ${req.url}`,
        err,
      );
      const message =
        !isProduction && err instanceof Error
          ? err.message
          : "Erreur serveur";
      res.status(500).json({ error: message });
    },
  );

  return app;
}
