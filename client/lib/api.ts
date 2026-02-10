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
  CreateAidInput,
  CreateVisitNoteInput,
  CreateCategoryInput,
  CreateArticleInput,
} from "@shared/schema";
import { getSessionToken, clearSession } from "@/lib/session";
import type { LoginResponse } from "@shared/api";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getSessionToken();

  // Log pour debug
  if (typeof window !== 'undefined' && !token) {
    console.warn(`[API] No token for request to ${url}`);
  }

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Erreur serveur" }));

    // Log for debugging
    console.error(`[API] Error ${res.status} from ${url}:`, error);

    if (res.status === 401 || error.error === "Compte désactivé") {
      clearSession();
      // Don't redirect here - let React Router handle it
      // The component will re-render and ProtectedRoute will redirect
    }
    throw new Error(error.error || `Erreur ${res.status}`);
  }
  return res.json();
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

  createAid: (data: CreateAidInput) =>
    fetchJson<Aid>("/api/aids", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Notes
  getNotes: (familyId: string) =>
    fetchJson<VisitNote[]>(`/api/families/${familyId}/notes`),

  createNote: (
    familyId: string,
    data: Omit<CreateVisitNoteInput, "familyId">,
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
