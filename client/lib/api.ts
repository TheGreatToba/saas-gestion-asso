import type {
  Family,
  Child,
  Need,
  Aid,
  VisitNote,
  DashboardStats,
  User,
  CreateFamilyInput,
  CreateChildInput,
  CreateNeedInput,
  CreateAidInput,
  CreateVisitNoteInput,
} from "@shared/schema";

function getStoredUserId(): string | undefined {
  try {
    const stored = localStorage.getItem("socialaid_user");
    if (stored) {
      const user = JSON.parse(stored);
      return user?.id;
    }
  } catch {
    // ignore
  }
  return undefined;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const userId = getStoredUserId();
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(userId ? { "x-user-id": userId } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Erreur serveur" }));
    throw new Error(error.error || `Erreur ${res.status}`);
  }
  return res.json();
}

// ==================== Dashboard ====================

export const api = {
  // Dashboard
  getDashboardStats: () => fetchJson<DashboardStats>("/api/dashboard/stats"),

  // Families
  getFamilies: (search?: string) =>
    fetchJson<Family[]>(search ? `/api/families?search=${encodeURIComponent(search)}` : "/api/families"),

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

  // Needs
  getNeeds: () => fetchJson<Need[]>("/api/needs"),

  getNeedsByFamily: (familyId: string) =>
    fetchJson<Need[]>(`/api/families/${familyId}/needs`),

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

  createNote: (familyId: string, data: Omit<CreateVisitNoteInput, "familyId">) =>
    fetchJson<VisitNote>(`/api/families/${familyId}/notes`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Users
  getUsers: () => fetchJson<User[]>("/api/users"),

  // Export
  getExportData: () => fetchJson<any>("/api/export"),
};
