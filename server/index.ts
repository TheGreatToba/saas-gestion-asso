import "dotenv/config";
import express, { RequestHandler } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { handleDemo } from "./routes/demo";
import {
  handleLogin,
  handleRegister,
  handleConfirmEmail,
  handleAcceptInvite,
  handleGetUsers,
  handleLogout,
  handleMe,
} from "./routes/auth";
import { handleInviteUser, handleCreateUser, handleUpdateUser, handleDeleteUser, handleGetAssignableUsers } from "./routes/users";
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
  handleGetInterventions,
  handleGetMyInterventions,
  handleGetIntervention,
  handleCreateIntervention,
  handleUpdateIntervention,
  handleUpdateInterventionStatus,
  handleUpdateInterventionChecklist,
  handleDeleteIntervention,
} from "./routes/interventions";
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
import { handleGetAuditLogs, handlePruneAuditLogs, handleExportAuditLogs } from "./routes/audit";
import { handleImportFamilies } from "./routes/import";
import {
  handleGetFamilyDocuments,
  handleCreateFamilyDocument,
  handleDeleteFamilyDocument,
  handleGetFamilyDocumentDownloadUrl,
} from "./routes/documents";
import { storage } from "./storage";
import { verifyAuthToken } from "./auth-token";
import { rateLimitLogin, setRateLimitStore } from "./rate-limit";
import { createRedisRateLimitStore } from "./rate-limit-redis";
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

/** Role type aligned with shared schema */
type AppRole = "admin" | "coordinator" | "volunteer" | "auditor";

/**
 * Requires the authenticated user to be an admin.
 * Must be used after requireAuth.
 */
const requireAdmin: RequestHandler = (_req, res, next) => {
  const user = res.locals.user as { role?: AppRole } | undefined;
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Accès réservé aux administrateurs" });
    return;
  }
  next();
};

/**
 * Requires the authenticated user to have one of the given roles.
 * Must be used after requireAuth.
 */
function requireRole(...allowed: AppRole[]): RequestHandler {
  const set = new Set(allowed);
  return (_req, res, next) => {
    const user = res.locals.user as { role?: AppRole } | undefined;
    if (!user || !set.has(user.role as AppRole)) {
      res.status(403).json({
        error:
          allowed.length === 1
            ? "Accès réservé"
            : "Droits insuffisants pour cette action",
      });
      return;
    }
    next();
  };
}

/** Auditeur = lecture seule ; les écritures sont réservées à admin, coordinateur, bénévole. */
const requireCanWrite = requireRole("admin", "coordinator", "volunteer");

export function createServer() {
  const app = express();

  // Rate limit store: Redis if RATE_LIMIT_REDIS_URL set, else in-memory
  const redisUrl = process.env.RATE_LIMIT_REDIS_URL;
  if (redisUrl) {
    try {
      const redisStore = createRedisRateLimitStore(redisUrl);
      setRateLimitStore(redisStore);
      console.log("[rate-limit] Using Redis store for horizontal scaling");
    } catch (err) {
      console.warn("[rate-limit] Redis init failed, using in-memory store:", err);
    }
  }

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
  app.get("/api/auth/confirm-email", asyncHandler(handleConfirmEmail));
  app.post("/api/auth/accept-invite", rateLimitLogin, asyncHandler(handleAcceptInvite));
  app.get("/api/auth/me", requireAuth, asyncHandler(handleMe));
  app.post("/api/auth/logout", requireAuth, asyncHandler(handleLogout));

  // Organisation courante (utilisateur connecté)
  app.get("/api/organizations/current", requireAuth, (req, res) => {
    const user = res.locals.user as { organizationId?: string } | undefined;
    const orgId = user?.organizationId ?? "org-default";
    const org = storage.getOrganization(orgId);
    if (!org) {
      res.status(404).json({ error: "Organisation non trouvée" });
      return;
    }
    res.json(org);
  });

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
  app.get(
    "/api/users/assignable",
    requireAuth,
    requireRole("admin", "coordinator"),
    asyncHandler(handleGetAssignableUsers),
  );
  app.post(
    "/api/users/invite",
    requireAuth,
    requireAdmin,
    asyncHandler(handleInviteUser),
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
    requireRole("admin", "coordinator"),
    asyncHandler(handleGetExportData),
  );
  app.get(
    "/api/audit-logs",
    requireAuth,
    requireRole("admin", "auditor"),
    asyncHandler(handleGetAuditLogs),
  );
  app.get(
    "/api/audit-logs/export",
    requireAuth,
    requireAdmin,
    asyncHandler(handleExportAuditLogs),
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
    requireRole("admin", "coordinator"),
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

  // Families (authenticated; écriture = admin, coordinateur, bénévole)
  app.get("/api/families", requireAuth, asyncHandler(handleGetFamilies));
  app.post(
    "/api/families",
    requireAuth,
    requireCanWrite,
    asyncHandler(handleCreateFamily),
  );
  app.get("/api/families/:id", requireAuth, asyncHandler(handleGetFamily));
  app.put(
    "/api/families/:id",
    requireAuth,
    requireCanWrite,
    asyncHandler(handleUpdateFamily),
  );
  app.delete(
    "/api/families/:id",
    requireAuth,
    requireRole("admin", "coordinator"),
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

  // Children (authenticated, delete = admin ou coordinateur)
  app.get(
    "/api/families/:familyId/children",
    requireAuth,
    asyncHandler(handleGetChildren),
  );
  app.post(
    "/api/families/:familyId/children",
    requireAuth,
    requireCanWrite,
    asyncHandler(handleCreateChild),
  );
  app.put(
    "/api/children/:id",
    requireAuth,
    requireCanWrite,
    asyncHandler(handleUpdateChild),
  );
  app.delete(
    "/api/children/:id",
    requireAuth,
    requireRole("admin", "coordinator"),
    asyncHandler(handleDeleteChild),
  );

  // Needs (authenticated; écriture = admin, coordinateur, bénévole)
  app.get("/api/needs", requireAuth, asyncHandler(handleGetNeeds));
  app.post(
    "/api/needs",
    requireAuth,
    requireCanWrite,
    asyncHandler(handleCreateNeed),
  );
  app.put(
    "/api/needs/:id",
    requireAuth,
    requireCanWrite,
    asyncHandler(handleUpdateNeed),
  );
  app.delete(
    "/api/needs/:id",
    requireAuth,
    requireRole("admin", "coordinator"),
    handleDeleteNeed,
  );
  app.get(
    "/api/families/:familyId/needs",
    requireAuth,
    asyncHandler(handleGetNeedsByFamily),
  );

  // Aids (authenticated; écriture = admin, coordinateur, bénévole)
  app.get("/api/aids", requireAuth, asyncHandler(handleGetAids));
  app.post(
    "/api/aids",
    requireAuth,
    requireCanWrite,
    asyncHandler(handleCreateAid),
  );
  app.delete(
    "/api/aids/:id",
    requireAuth,
    requireRole("admin", "coordinator"),
    asyncHandler(handleDeleteAid),
  );
  app.get(
    "/api/families/:familyId/aids",
    requireAuth,
    asyncHandler(handleGetAidsByFamily),
  );

  // Visit Notes (authenticated; écriture = admin, coordinateur, bénévole)
  app.get(
    "/api/families/:familyId/notes",
    requireAuth,
    asyncHandler(handleGetNotes),
  );
  app.post(
    "/api/families/:familyId/notes",
    requireAuth,
    requireCanWrite,
    asyncHandler(handleCreateNote),
  );

  // Interventions (planning, missions assignées)
  app.get(
    "/api/interventions",
    requireAuth,
    asyncHandler(handleGetInterventions),
  );
  app.get(
    "/api/interventions/mine",
    requireAuth,
    asyncHandler(handleGetMyInterventions),
  );
  app.get(
    "/api/interventions/:id",
    requireAuth,
    asyncHandler(handleGetIntervention),
  );
  app.post(
    "/api/interventions",
    requireAuth,
    requireRole("admin", "coordinator"),
    asyncHandler(handleCreateIntervention),
  );
  app.put(
    "/api/interventions/:id",
    requireAuth,
    requireRole("admin", "coordinator"),
    asyncHandler(handleUpdateIntervention),
  );
  app.patch(
    "/api/interventions/:id/status",
    requireAuth,
    requireCanWrite,
    asyncHandler(handleUpdateInterventionStatus),
  );
  app.patch(
    "/api/interventions/:id/checklist",
    requireAuth,
    requireCanWrite,
    asyncHandler(handleUpdateInterventionChecklist),
  );
  app.delete(
    "/api/interventions/:id",
    requireAuth,
    requireRole("admin", "coordinator"),
    asyncHandler(handleDeleteIntervention),
  );

  // Family Documents (admin ou coordinateur)
  app.get(
    "/api/families/:familyId/documents",
    requireAuth,
    requireRole("admin", "coordinator"),
    asyncHandler(handleGetFamilyDocuments),
  );
  app.post(
    "/api/families/:familyId/documents",
    requireAuth,
    requireRole("admin", "coordinator"),
    asyncHandler(handleCreateFamilyDocument),
  );
  app.delete(
    "/api/families/:familyId/documents/:documentId",
    requireAuth,
    requireRole("admin", "coordinator"),
    asyncHandler(handleDeleteFamilyDocument),
  );
  app.get(
    "/api/families/:familyId/documents/:documentId/download",
    requireAuth,
    requireRole("admin", "coordinator"),
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
