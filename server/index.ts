import "dotenv/config";
import express, { RequestHandler } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { handleDemo } from "./routes/demo";
import {
  handleLogin,
  handleRegister,
  handleGetUsers,
  handleLogout,
  handleMe,
} from "./routes/auth";
import { handleCreateUser, handleUpdateUser, handleDeleteUser } from "./routes/users";
import {
  handleGetFamilies,
  handleGetFamily,
  handleCreateFamily,
  handleUpdateFamily,
  handleDeleteFamily,
  handlePurgeArchivedFamilies,
  handleResetAllFamilies,
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
  handleDeleteAid,
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
import { handleGetAuditLogs, handlePruneAuditLogs } from "./routes/audit";
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
import { requireCsrf, generateCsrfToken, setCsrfCookie } from "./csrf";
import { asyncHandler, AppError, isAppError } from "./errors";
import {
  generateRequestId,
  logError,
  logInfo,
  notifyOnSevereError,
} from "./logger";
import { recordRequest, getMetrics } from "./metrics";
import { getDb } from "./db";

const isProduction = process.env.NODE_ENV === "production";

// ---------- Auth Middleware ----------

/**
 * Requires a valid auth token from the "auth_token" cookie (primary) or
 * Authorization Bearer header (deprecated fallback). Attaches the user to res.locals.user.
 */
const requireAuth: RequestHandler = (req, res, next) => {
  const cookieToken =
    (req as any).cookies?.auth_token ?? (req as any).signedCookies?.auth_token;
  const header = req.headers.authorization;
  const headerToken = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  const token = cookieToken ?? headerToken;
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
  console.log("[CORS] Origines autorisées:", allowedOrigins);

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

  // CSRF: validate token on mutating requests (POST/PUT/PATCH/DELETE)
  app.use(requireCsrf);

  // Request context + access logging + metrics
  app.use((req, res, next) => {
    const start = Date.now();
    const requestId =
      (req.headers["x-request-id"] as string | undefined) ?? generateRequestId();
    (res as any).locals.requestId = requestId;
    res.setHeader("X-Request-Id", requestId);

    res.on("finish", () => {
      const latencyMs = Date.now() - start;
      const user = (res as any).locals?.user as
        | { id: string }
        | undefined;
      recordRequest(res.statusCode, latencyMs);
      logInfo("request_completed", {
        requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        latencyMs,
        userId: user?.id,
      });
    });

    next();
  });

  // Health check (for load balancers)
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // Deep health check (DB connectivity)
  app.get("/api/health", (_req, res) => {
    try {
      getDb().prepare("SELECT 1").get();
      res.status(200).json({ status: "ok", db: "ok" });
    } catch (e) {
      res.status(503).json({ status: "degraded", db: "error" });
    }
  });

  // Metrics (admin only)
  app.get("/api/metrics", requireAuth, requireAdmin, (_req, res) => {
    res.status(200).json(getMetrics());
  });

  // Legacy routes (public)
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });
  app.get("/api/demo", handleDemo);

  // CSRF token (public): sets cookie and returns token for client to send on mutations
  app.get("/api/csrf", (req, res) => {
    const token = generateCsrfToken();
    setCsrfCookie(res, token);
    res.json({ csrfToken: token });
  });

  // Auth (public — login and register don't require auth)
  app.post("/api/auth/login", rateLimitLogin, asyncHandler(handleLogin));
  app.post(
    "/api/auth/register",
    rateLimitLogin,
    asyncHandler(handleRegister),
  );
  app.get("/api/auth/me", requireAuth, asyncHandler(handleMe));
  app.post("/api/auth/logout", requireAuth, asyncHandler(handleLogout));

  // Categories (public read, admin write)
  app.get("/api/categories", asyncHandler(handleGetCategories));
  app.post(
    "/api/categories",
    requireAuth,
    requireAdmin,
    asyncHandler(handleCreateCategory),
  );
  app.put(
    "/api/categories/:id",
    requireAuth,
    requireAdmin,
    asyncHandler(handleUpdateCategory),
  );
  app.delete(
    "/api/categories/:id",
    requireAuth,
    requireAdmin,
    asyncHandler(handleDeleteCategory),
  );

  // Articles (public read, admin write)
  app.get("/api/articles", asyncHandler(handleGetAllArticles));
  app.get(
    "/api/categories/:categoryId/articles",
    asyncHandler(handleGetArticlesByCategory),
  );
  app.post(
    "/api/articles",
    requireAuth,
    requireAdmin,
    asyncHandler(handleCreateArticle),
  );
  app.put(
    "/api/articles/:id",
    requireAuth,
    requireAdmin,
    asyncHandler(handleUpdateArticle),
  );
  app.delete(
    "/api/articles/:id",
    requireAuth,
    requireAdmin,
    asyncHandler(handleDeleteArticle),
  );
  app.patch(
    "/api/articles/:id/stock",
    requireAuth,
    requireAdmin,
    asyncHandler(handleAdjustArticleStock),
  );

  // ----- Admin-only routes -----
  app.get(
    "/api/users",
    requireAuth,
    requireAdmin,
    asyncHandler(handleGetUsers),
  );
  app.post(
    "/api/users",
    requireAuth,
    requireAdmin,
    asyncHandler(handleCreateUser),
  );
  app.patch(
    "/api/users/:id",
    requireAuth,
    requireAdmin,
    asyncHandler(handleUpdateUser),
  );
  app.delete(
    "/api/users/:id",
    requireAuth,
    requireAdmin,
    asyncHandler(handleDeleteUser),
  );
  app.get(
    "/api/export",
    requireAuth,
    requireAdmin,
    asyncHandler(handleGetExportData),
  );
  app.get(
    "/api/audit-logs",
    requireAuth,
    requireAdmin,
    asyncHandler(handleGetAuditLogs),
  );
  app.post(
    "/api/audit-logs/prune",
    requireAuth,
    requireAdmin,
    asyncHandler(handlePruneAuditLogs),
  );
  app.post(
    "/api/import/families",
    requireAuth,
    requireAdmin,
    asyncHandler(handleImportFamilies),
  );

  // Dashboard (authenticated)
  app.get(
    "/api/dashboard/stats",
    requireAuth,
    asyncHandler(handleGetDashboardStats),
  );

  // Global search (authenticated)
  app.get("/api/search", requireAuth, asyncHandler(handleSearch));

  // Families (authenticated, delete = admin only)
  app.get("/api/families", requireAuth, asyncHandler(handleGetFamilies));
  app.post("/api/families", requireAuth, asyncHandler(handleCreateFamily));
  app.get("/api/families/:id", requireAuth, asyncHandler(handleGetFamily));
  app.put("/api/families/:id", requireAuth, asyncHandler(handleUpdateFamily));
  app.delete(
    "/api/families/:id",
    requireAuth,
    requireAdmin,
    asyncHandler(handleDeleteFamily),
  );
  app.post(
    "/api/families/purge-archived",
    requireAuth,
    requireAdmin,
    asyncHandler(handlePurgeArchivedFamilies),
  );
  app.post(
    "/api/families/reset-all",
    requireAuth,
    requireAdmin,
    asyncHandler(handleResetAllFamilies),
  );

  // Children (authenticated, delete = admin only)
  app.get(
    "/api/families/:familyId/children",
    requireAuth,
    asyncHandler(handleGetChildren),
  );
  app.post(
    "/api/families/:familyId/children",
    requireAuth,
    asyncHandler(handleCreateChild),
  );
  app.put("/api/children/:id", requireAuth, asyncHandler(handleUpdateChild));
  app.delete(
    "/api/children/:id",
    requireAuth,
    requireAdmin,
    asyncHandler(handleDeleteChild),
  );

  // Needs (authenticated, delete = admin only)
  app.get("/api/needs", requireAuth, asyncHandler(handleGetNeeds));
  app.post("/api/needs", requireAuth, asyncHandler(handleCreateNeed));
  app.put("/api/needs/:id", requireAuth, asyncHandler(handleUpdateNeed));
  app.delete("/api/needs/:id", requireAuth, requireAdmin, handleDeleteNeed);
  app.get(
    "/api/families/:familyId/needs",
    requireAuth,
    asyncHandler(handleGetNeedsByFamily),
  );

  // Aids (authenticated)
  app.get("/api/aids", requireAuth, asyncHandler(handleGetAids));
  app.post("/api/aids", requireAuth, asyncHandler(handleCreateAid));
  app.delete(
    "/api/aids/:id",
    requireAuth,
    requireAdmin,
    asyncHandler(handleDeleteAid),
  );
  app.get(
    "/api/families/:familyId/aids",
    requireAuth,
    asyncHandler(handleGetAidsByFamily),
  );

  // Visit Notes (authenticated)
  app.get(
    "/api/families/:familyId/notes",
    requireAuth,
    asyncHandler(handleGetNotes),
  );
  app.post(
    "/api/families/:familyId/notes",
    requireAuth,
    asyncHandler(handleCreateNote),
  );

  // Family Documents (admin only - documents souvent sensibles)
  app.get(
    "/api/families/:familyId/documents",
    requireAuth,
    requireAdmin,
    asyncHandler(handleGetFamilyDocuments),
  );
  app.post(
    "/api/families/:familyId/documents",
    requireAuth,
    requireAdmin,
    asyncHandler(handleCreateFamilyDocument),
  );
  app.delete(
    "/api/families/:familyId/documents/:documentId",
    requireAuth,
    requireAdmin,
    asyncHandler(handleDeleteFamilyDocument),
  );
  app.get(
    "/api/families/:familyId/documents/:documentId/download",
    requireAuth,
    requireAdmin,
    asyncHandler(handleGetFamilyDocumentDownloadUrl),
  );

  // Error handler
  app.use(
    (
      err: unknown,
      req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const requestId = (res as any).locals?.requestId as
        | string
        | undefined;
      const user = (res as any).locals?.user as
        | { id: string }
        | undefined;

      let statusCode = 500;
      let clientMessage = "Erreur serveur";
      let details: unknown;

      if (isAppError(err)) {
        statusCode = err.statusCode;
        clientMessage = err.message;
        details = err.details;
      }

      const isServerError = statusCode >= 500;
      const errorMessage =
        err instanceof Error ? err.message : String(err);

      logError(errorMessage, {
        requestId,
        userId: user?.id,
        method: req.method,
        path: req.originalUrl,
        statusCode,
        errorName: err instanceof Error ? err.name : undefined,
        stack: err instanceof Error ? err.stack : undefined,
      });

      if (
        isServerError ||
        (err instanceof AppError && err.kind === "technical")
      ) {
        notifyOnSevereError(errorMessage, {
          requestId,
          userId: user?.id,
          method: req.method,
          path: req.originalUrl,
          statusCode,
        });
      }

      const responseBody: Record<string, unknown> = {
        error:
          !isProduction && !isAppError(err) && err instanceof Error
            ? err.message
            : clientMessage,
      };

      if (details !== undefined) {
        responseBody.details = details;
      }

      if (requestId) {
        responseBody.requestId = requestId;
      }

      res.status(statusCode).json(responseBody);
    },
  );

  return app;
}
