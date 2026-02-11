import type {
  Family,
  Child,
  Need,
  EnrichedNeed,
  Aid,
  VisitNote,
  DashboardStats,
  User,
  Category,
  Article,
  CreateFamilyInput,
  CreateChildInput,
  CreateNeedInput,
  CreateAidClientInput,
  CreateVisitNoteClientInput,
  CreateCategoryInput,
  CreateArticleInput,
} from "@shared/schema";
import { getSessionToken, clearSession } from "@/lib/session";

type FetchJsonOptions = RequestInit & {
  /**
   * Délai maximum avant d'abandonner la requête (ms).
   * Par défaut 15s.
   */
  timeoutMs?: number;
  /**
   * Nombre de tentatives supplémentaires en cas d'erreur réseau / timeout.
   * Par défaut 0 (pas de retry implicite).
   */
  retry?: number;
  /**
   * Délai de base entre les tentatives (ms), avec petit backoff linéaire.
   * Par défaut 500ms.
   */
  retryDelayMs?: number;
};

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(
  url: string,
  options: FetchJsonOptions = {},
): Promise<T> {
  const {
    timeoutMs = 15_000,
    retry = 0,
    retryDelayMs = 500,
    ...requestInit
  } = options;

  const token = getSessionToken();

  let attempt = 0;
  // On limite volontairement les retries implicites aux méthodes considérées comme sûres.
  const method = (requestInit.method || "GET").toUpperCase();
  const maxRetriesForThisRequest =
    method === "GET" || method === "HEAD" ? retry : 0;

  // Boucle de retry contrôlé
  // - Timeout explicite via AbortController
  // - Retry seulement en cas d'erreur réseau / timeout
  for (;;) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...requestInit,
        credentials: "include", // envoie le cookie auth_token (auth principale)
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...requestInit.headers,
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        const error = await res
          .json()
          .catch(() => ({ error: "Erreur serveur" }));

        if (res.status === 401 || error.error === "Compte désactivé") {
          clearSession();
        }
        if (res.status === 404) {
          throw new Error(
            error.error ||
              "Service non trouvé. Lancez l’application avec « pnpm dev » (client + API sur le même serveur).",
          );
        }
        throw new Error(error.error || `Erreur ${res.status}`);
      }

      return res.json();
    } catch (err) {
      const e = err as any;
      const isAbortError = e?.name === "AbortError";
      // Dans les navigateurs, les erreurs réseau sont typées TypeError
      const isNetworkError = e instanceof TypeError || isAbortError;

      if (!isNetworkError || attempt >= maxRetriesForThisRequest) {
        // Message plus explicite en cas de problème réseau/timeout
        if (isNetworkError) {
          throw new Error(
            "Erreur réseau. Vérifiez votre connexion (Wi‑Fi/4G) et réessayez.",
          );
        }
        throw err;
      }

      attempt += 1;
      // Petit backoff linéaire : retryDelayMs, 2x, 3x...
      await sleep(retryDelayMs * attempt);
      continue;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// ==================== Dashboard ====================

export const api = {
  // Auth helpers
  getMe: () => fetchJson<{ user: import("@shared/schema").User }>("/api/auth/me"),

  // Categories
  getCategories: () => fetchJson<Category[]>("/api/categories"),

  createCategory: (data: CreateCategoryInput) =>
    fetchJson<Category>("/api/categories", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateCategory: (id: string, data: Partial<CreateCategoryInput>) =>
    fetchJson<Category>(`/api/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteCategory: (id: string) =>
    fetchJson<{ success: boolean }>(`/api/categories/${id}`, {
      method: "DELETE",
    }),

  // Articles (stock variants)
  getAllArticles: () => fetchJson<Article[]>("/api/articles"),

  getArticlesByCategory: (categoryId: string) =>
    fetchJson<Article[]>(`/api/categories/${categoryId}/articles`),

  createArticle: (data: CreateArticleInput) =>
    fetchJson<Article>("/api/articles", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateArticle: (
    id: string,
    data: Partial<Omit<CreateArticleInput, "categoryId">>,
  ) =>
    fetchJson<Article>(`/api/articles/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteArticle: (id: string) =>
    fetchJson<{ success: boolean }>(`/api/articles/${id}`, {
      method: "DELETE",
    }),

  adjustArticleStock: (id: string, delta: number) =>
    fetchJson<Article>(`/api/articles/${id}/stock`, {
      method: "PATCH",
      body: JSON.stringify({ delta }),
    }),

  // Dashboard
  getDashboardStats: () => fetchJson<DashboardStats>("/api/dashboard/stats"),

  // Families
  getFamilies: (search?: string) =>
    fetchJson<Family[]>(
      search
        ? `/api/families?search=${encodeURIComponent(search)}`
        : "/api/families",
    ),

  getFamily: (id: string) => fetchJson<Family>(`/api/families/${id}`),

  createFamily: (data: CreateFamilyInput) =>
    fetchJson<Family>("/api/families", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateFamily: (id: string, data: Partial<CreateFamilyInput>) =>
    fetchJson<Family>(`/api/families/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteFamily: (id: string) =>
    fetchJson<{ success: boolean }>(`/api/families/${id}`, {
      method: "DELETE",
    }),

  // Admin: reset / purge familles
  resetAllFamilies: () =>
    fetchJson<{ purged: number }>("/api/families/reset-all", {
      method: "POST",
    }),
  purgeArchivedFamilies: () =>
    fetchJson<{ purged: number }>("/api/families/purge-archived", {
      method: "POST",
    }),

  // Children
  getChildren: (familyId: string) =>
    fetchJson<Child[]>(`/api/families/${familyId}/children`),

  createChild: (familyId: string, data: Omit<CreateChildInput, "familyId">) =>
    fetchJson<Child>(`/api/families/${familyId}/children`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteChild: (id: string) =>
    fetchJson<{ success: boolean }>(`/api/children/${id}`, {
      method: "DELETE",
    }),

  // Needs (API returns enriched needs with priority score/level)
  getNeeds: () => fetchJson<EnrichedNeed[]>("/api/needs"),

  getNeedsByFamily: (familyId: string) =>
    fetchJson<EnrichedNeed[]>(`/api/families/${familyId}/needs`),

  createNeed: (data: CreateNeedInput) =>
    fetchJson<Need>("/api/needs", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateNeed: (id: string, data: Record<string, unknown>) =>
    fetchJson<Need>(`/api/needs/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteNeed: (id: string) =>
    fetchJson<{ success: boolean }>(`/api/needs/${id}`, {
      method: "DELETE",
    }),

  // Aids
  getAids: () => fetchJson<Aid[]>("/api/aids"),

  getAidsByFamily: (familyId: string) =>
    fetchJson<Aid[]>(`/api/families/${familyId}/aids`),

  createAid: (data: CreateAidClientInput) =>
    fetchJson<Aid>("/api/aids", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteAid: (id: string) =>
    fetchJson<{ success: boolean }>(`/api/aids/${id}`, {
      method: "DELETE",
    }),

  // Notes
  getNotes: (familyId: string) =>
    fetchJson<VisitNote[]>(`/api/families/${familyId}/notes`),

  createNote: (
    familyId: string,
    data: Omit<CreateVisitNoteClientInput, "familyId">,
  ) =>
    fetchJson<VisitNote>(`/api/families/${familyId}/notes`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Users
  getUsers: () => fetchJson<User[]>("/api/users"),

  createUser: (data: import("@shared/schema").CreateUserInput) =>
    fetchJson<User>("/api/users", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateUser: (id: string, data: import("@shared/schema").UpdateUserInput) =>
    fetchJson<User>(`/api/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteUser: (id: string) =>
    fetchJson<{ success: boolean }>(`/api/users/${id}`, {
      method: "DELETE",
    }),

  // Export (paginated)
  getExportData: (params?: { limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit !== undefined) {
      searchParams.set("limit", String(params.limit));
    }
    if (params?.offset !== undefined) {
      searchParams.set("offset", String(params.offset));
    }
    const query = searchParams.toString();
    const url = query ? `/api/export?${query}` : "/api/export";
    return fetchJson<any>(url);
  },

  importFamilies: (payload: {
    rows: Partial<CreateFamilyInput>[];
    duplicateStrategy: "skip" | "update";
  }) =>
    fetchJson<import("@shared/api").ImportFamiliesResult>(
      "/api/import/families",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    ),

  // Global search
  searchGlobal: (q: string) =>
    fetchJson<{ families: Family[]; needs: Need[]; aids: Aid[] }>(
      `/api/search?q=${encodeURIComponent(q)}`,
    ),

  // Audit log (admin)
  getAuditLogs: (limit?: number) =>
    fetchJson<import("@shared/schema").AuditLog[]>(
      limit ? `/api/audit-logs?limit=${limit}` : "/api/audit-logs",
    ),

  // Family documents
  getFamilyDocuments: (familyId: string) =>
    fetchJson<import("@shared/schema").FamilyDocument[]>(
      `/api/families/${familyId}/documents`,
    ),
  createFamilyDocument: (
    familyId: string,
    data: {
      name: string;
      documentType: string;
      fileData: string;
      mimeType: string;
    },
  ) =>
    fetchJson<import("@shared/schema").FamilyDocument>(
      `/api/families/${familyId}/documents`,
      { method: "POST", body: JSON.stringify({ ...data, familyId }) },
    ),
  getFamilyDocumentDownloadUrl: (familyId: string, documentId: string) =>
    fetchJson<{ url: string; expiresInSeconds: number }>(
      `/api/families/${familyId}/documents/${documentId}/download`,
    ),
  deleteFamilyDocument: (familyId: string, documentId: string) =>
    fetchJson<{ success: boolean }>(
      `/api/families/${familyId}/documents/${documentId}`,
      { method: "DELETE" },
    ),
};
