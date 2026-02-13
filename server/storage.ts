import type {
  User,
  Family,
  Child,
  Need,
  Aid,
  VisitNote,
  Category,
  Article,
  CreateFamilyInput,
  CreateChildInput,
  CreateNeedInput,
  CreateAidStorageInput,
  CreateVisitNoteStorageInput,
  CreateCategoryInput,
  CreateArticleInput,
  CreateUserInput,
  UpdateUserInput,
  DashboardStats,
  AuditLog,
  FamilyDocument,
  CreateFamilyDocumentInput,
} from "../shared/schema";
import { createHash, randomBytes } from "node:crypto";
import { getDb } from "./db";
import type Database from "better-sqlite3";
import { hashPassword, isPasswordHash, verifyPassword } from "./passwords";
import { FamiliesRepository, mapFamilyRow, type FamilyRow } from "./repositories/families.repository";
import { FamilyService } from "./services/family.service";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

function now(): string {
  return new Date().toISOString();
}

// --- Row mappers (DB snake_case -> schema camelCase) ---
type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: number;
  organization_id: string | null;
};
function mapUser(r: UserRow): User {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role as User["role"],
    active: !!r.active,
    organizationId: r.organization_id ?? "org-default",
  };
}

type ChildRow = {
  id: string;
  family_id: string;
  first_name: string;
  age: number;
  sex: string;
  specific_needs: string;
  created_at: string;
};
function mapChild(r: ChildRow): Child {
  return {
    id: r.id,
    familyId: r.family_id,
    firstName: r.first_name,
    age: r.age,
    sex: r.sex as Child["sex"],
    specificNeeds: r.specific_needs ?? "",
    createdAt: r.created_at,
  };
}

type NeedRow = {
  id: string;
  family_id: string;
  type: string;
  urgency: string;
  status: string;
  comment: string;
  details: string;
  created_at: string;
  updated_at: string;
};
function mapNeed(r: NeedRow): Need {
  return {
    id: r.id,
    familyId: r.family_id,
    type: r.type,
    urgency: r.urgency as Need["urgency"],
    status: r.status as Need["status"],
    comment: r.comment ?? "",
    details: r.details ?? "",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

type AidRow = {
  id: string;
  family_id: string;
  type: string;
  article_id: string;
  quantity: number;
  date: string;
  volunteer_id: string;
  volunteer_name: string;
  source: string;
  notes: string;
  proof_url: string;
  created_at: string;
};
function mapAid(r: AidRow): Aid {
  return {
    id: r.id,
    familyId: r.family_id,
    type: r.type,
    articleId: r.article_id || undefined,
    quantity: r.quantity,
    date: r.date,
    volunteerId: r.volunteer_id,
    volunteerName: r.volunteer_name,
    source: r.source as Aid["source"],
    notes: r.notes ?? "",
    proofUrl: r.proof_url ?? "",
    createdAt: r.created_at,
  };
}

type VisitNoteRow = {
  id: string;
  family_id: string;
  volunteer_id: string;
  volunteer_name: string;
  content: string;
  date: string;
  created_at: string;
};
function mapVisitNote(r: VisitNoteRow): VisitNote {
  return {
    id: r.id,
    familyId: r.family_id,
    volunteerId: r.volunteer_id,
    volunteerName: r.volunteer_name,
    content: r.content,
    date: r.date,
    createdAt: r.created_at,
  };
}

type CategoryRow = {
  id: string;
  name: string;
  description: string;
  created_at: string;
};
function mapCategory(r: CategoryRow): Category {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? "",
    createdAt: r.created_at,
  };
}

type ArticleRow = {
  id: string;
  category_id: string;
  name: string;
  description: string;
  unit: string;
  stock_quantity: number;
  stock_min: number;
  created_at: string;
};
function mapArticle(r: ArticleRow): Article {
  return {
    id: r.id,
    categoryId: r.category_id,
    name: r.name,
    description: r.description ?? "",
    unit: r.unit ?? "unités",
    stockQuantity: r.stock_quantity,
    stockMin: r.stock_min,
    createdAt: r.created_at,
  };
}

type AuditLogRow = {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string | null;
  created_at: string;
};
function mapAuditLog(r: AuditLogRow): AuditLog {
  return {
    id: r.id,
    userId: r.user_id,
    userName: r.user_name,
    action: r.action as AuditLog["action"],
    entityType: r.entity_type as AuditLog["entityType"],
    entityId: r.entity_id,
    details: r.details ?? undefined,
    createdAt: r.created_at,
  };
}

type FamilyDocumentRow = {
  id: string;
  family_id: string;
  name: string;
  document_type: string;
  file_data: string | null;
  mime_type: string;
  uploaded_at: string;
  uploaded_by: string;
  uploaded_by_name: string;
  file_key: string | null;
};
function mapFamilyDocument(r: FamilyDocumentRow): FamilyDocument {
  return {
    id: r.id,
    familyId: r.family_id,
    name: r.name,
    documentType: r.document_type as FamilyDocument["documentType"],
    fileKey: r.file_key ?? "",
    mimeType: r.mime_type,
    uploadedAt: r.uploaded_at,
    uploadedBy: r.uploaded_by,
    uploadedByName: r.uploaded_by_name,
    // URL signée ajoutée au niveau des routes (non stockée en base)
    downloadUrl: undefined,
  };
}

class Storage {
  private testDb?: Database.Database;
  private familiesRepo: FamiliesRepository;
  private familyService: FamilyService;

  constructor(testDb?: Database.Database) {
    this.testDb = testDb;
    const getDbInstance = () => this.testDb ?? getDb();
    this.familiesRepo = new FamiliesRepository(getDbInstance);
    this.familyService = new FamilyService(this.familiesRepo);
  }

  private get db(): Database.Database {
    return this.testDb ?? getDb();
  }

  // ==================== AUTH ====================

  authenticate(
    email: string,
    password: string,
  ): { user: User | null; error?: "disabled" } {
    const user = this.db
      .prepare("SELECT id, name, email, role, active FROM users WHERE email = ?")
      .get(email) as UserRow | undefined;
    if (!user) return { user: null };
    const row = this.db
      .prepare("SELECT password FROM passwords WHERE user_id = ?")
      .get(user.id) as { password: string } | undefined;
    if (!row) return { user: null };
    const stored = row.password;
    const valid = verifyPassword(password, stored);
    if (!valid) return { user: null };
    if (!user.active) return { user: null, error: "disabled" };
    // Migrate legacy plain-text password to hash on first successful login
    if (!isPasswordHash(stored)) {
      this.db
        .prepare("UPDATE passwords SET password = ? WHERE user_id = ?")
        .run(hashPassword(password), user.id);
    }
    return { user: mapUser(user) };
  }

  getUser(id: string): User | null {
    const r = this.db
      .prepare("SELECT id, name, email, role, active, organization_id FROM users WHERE id = ?")
      .get(id) as UserRow | undefined;
    return r ? mapUser(r) : null;
  }

  getAllUsers(organizationId: string): User[] {
    const rows = this.db
      .prepare(
        "SELECT id, name, email, role, active, organization_id FROM users WHERE organization_id = ? ORDER BY role DESC, name",
      )
      .all(organizationId) as UserRow[];
    return rows.map(mapUser);
  }

  getUserByEmail(email: string): User | null {
    const r = this.db
      .prepare("SELECT id, name, email, role, active, organization_id FROM users WHERE email = ?")
      .get(email) as UserRow | undefined;
    return r ? mapUser(r) : null;
  }

  countActiveAdmins(organizationId: string): number {
    const row = this.db
      .prepare(
        "SELECT COUNT(*) as c FROM users WHERE organization_id = ? AND role = 'admin' AND active = 1",
      )
      .get(organizationId) as { c: number };
    return row.c;
  }

  createUser(input: CreateUserInput, organizationId: string): User {
    const existing = this.db
      .prepare("SELECT 1 FROM users WHERE email = ?")
      .get(input.email);
    if (existing) {
      throw new Error("Email déjà utilisé");
    }
    const id = "usr-" + generateId();

    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          "INSERT INTO users (id, name, email, role, active, organization_id) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(
          id,
          input.name,
          input.email,
          input.role,
          input.active ? 1 : 0,
          organizationId,
        );
      this.db
        .prepare("INSERT INTO passwords (user_id, password) VALUES (?, ?)")
        .run(id, hashPassword(input.password));
    });

    tx();
    return this.getUser(id)!;
  }

  updateUser(id: string, input: UpdateUserInput): User | null {
    const current = this.db
      .prepare("SELECT id, name, email, role, active, organization_id FROM users WHERE id = ?")
      .get(id) as UserRow | undefined;
    if (!current) return null;

    if (input.email && input.email !== current.email) {
      const existing = this.db
        .prepare("SELECT 1 FROM users WHERE email = ?")
        .get(input.email);
      if (existing) {
        throw new Error("Email déjà utilisé");
      }
    }

    const name = input.name ?? current.name;
    const email = input.email ?? current.email;
    const role = input.role ?? (current.role as User["role"]);
    const active = input.active !== undefined ? (input.active ? 1 : 0) : current.active;

    this.db
      .prepare("UPDATE users SET name = ?, email = ?, role = ?, active = ? WHERE id = ?")
      .run(name, email, role, active, id);

    if (input.password) {
      this.db
        .prepare("UPDATE passwords SET password = ? WHERE user_id = ?")
        .run(hashPassword(input.password), id);
    }

    return this.getUser(id);
  }

  deleteUser(id: string): boolean {
    const user = this.getUser(id);
    if (!user) return false;
    
    // Supprimer l'utilisateur et son mot de passe en transaction
    const tx = this.db.transaction(() => {
      this.db.prepare("DELETE FROM passwords WHERE user_id = ?").run(id);
      this.db.prepare("DELETE FROM users WHERE id = ?").run(id);
    });
    
    tx();
    return true;
  }

  /** Crée un token de vérification email (24 h). Retourne le token en clair à envoyer par email. */
  createEmailVerificationToken(userId: string): string {
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const id = "evt-" + generateId();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    this.db
      .prepare(
        "INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
      )
      .run(id, userId, tokenHash, expiresAt);
    return token;
  }

  /**
   * Consomme le token : vérifie, supprime le token, active l'utilisateur.
   * Retourne l'id utilisateur si ok, null sinon (token invalide ou expiré).
   */
  consumeEmailVerificationToken(token: string): string | null {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const now = new Date().toISOString();
    const row = this.db
      .prepare(
        "SELECT id, user_id FROM email_verification_tokens WHERE token_hash = ? AND expires_at > ?",
      )
      .get(tokenHash, now) as { id: string; user_id: string } | undefined;
    if (!row) return null;
    this.db.prepare("DELETE FROM email_verification_tokens WHERE id = ?").run(row.id);
    this.db.prepare("UPDATE users SET active = 1 WHERE id = ?").run(row.user_id);
    return row.user_id;
  }

  /** Crée un utilisateur sans mot de passe (pour invitation). active=0, mot de passe temporaire. */
  createUserForInvite(
    input: { name: string; email: string; role: User["role"] },
    organizationId: string,
  ): User {
    const existing = this.db
      .prepare("SELECT 1 FROM users WHERE email = ?")
      .get(input.email);
    if (existing) {
      throw new Error("Email déjà utilisé");
    }
    const id = "usr-" + generateId();
    const placeholderPassword = hashPassword(randomBytes(32).toString("hex"));
    this.db
      .prepare(
        "INSERT INTO users (id, name, email, role, active, organization_id) VALUES (?, ?, ?, ?, 0, ?)",
      )
      .run(id, input.name, input.email, input.role, organizationId);
    this.db
      .prepare("INSERT INTO passwords (user_id, password) VALUES (?, ?)")
      .run(id, placeholderPassword);
    return this.getUser(id)!;
  }

  /** Crée un token d'invitation (7 jours). Retourne le token en clair. */
  createInvitationToken(userId: string): string {
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const id = "inv-" + generateId();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    this.db
      .prepare(
        "INSERT INTO invitations (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
      )
      .run(id, userId, tokenHash, expiresAt);
    return token;
  }

  /**
   * Consomme un token d'invitation : vérifie, supprime le token.
   * Retourne userId si ok, null sinon. Le mot de passe et l'activation sont à faire par l'appelant.
   */
  consumeInvitationToken(token: string): string | null {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const now = new Date().toISOString();
    const row = this.db
      .prepare(
        "SELECT id, user_id FROM invitations WHERE token_hash = ? AND expires_at > ?",
      )
      .get(tokenHash, now) as { id: string; user_id: string } | undefined;
    if (!row) return null;
    this.db.prepare("DELETE FROM invitations WHERE id = ?").run(row.id);
    return row.user_id;
  }

  // ==================== CATEGORIES ====================

  getAllCategories(): Category[] {
    const rows = this.db
      .prepare(
        "SELECT id, name, description, created_at FROM categories ORDER BY name",
      )
      .all() as CategoryRow[];
    return rows.map(mapCategory);
  }

  getCategory(id: string): Category | null {
    const r = this.db
      .prepare(
        "SELECT id, name, description, created_at FROM categories WHERE id = ?",
      )
      .get(id) as CategoryRow | undefined;
    return r ? mapCategory(r) : null;
  }

  createCategory(input: CreateCategoryInput): Category {
    const slug = input.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    let id = slug || "cat-" + generateId();
    const existing = this.db
      .prepare("SELECT 1 FROM categories WHERE id = ?")
      .get(id);
    if (existing) id = id + "-" + generateId();
    const createdAt = now();
    this.db
      .prepare(
        "INSERT INTO categories (id, name, description, created_at) VALUES (?, ?, ?, ?)",
      )
      .run(id, input.name, input.description ?? "", createdAt);
    return {
      id,
      name: input.name,
      description: input.description ?? "",
      createdAt,
    };
  }

  updateCategory(
    id: string,
    input: Partial<CreateCategoryInput>,
  ): Category | null {
    const r = this.db
      .prepare(
        "SELECT id, name, description, created_at FROM categories WHERE id = ?",
      )
      .get(id) as CategoryRow | undefined;
    if (!r) return null;
    const name = input.name ?? r.name;
    const description =
      input.description !== undefined ? input.description : r.description;
    this.db
      .prepare("UPDATE categories SET name = ?, description = ? WHERE id = ?")
      .run(name, description ?? "", id);
    return mapCategory({ ...r, name, description: description ?? "" });
  }

  deleteCategory(id: string): boolean {
    const info = this.db.prepare("DELETE FROM categories WHERE id = ?").run(id);
    return info.changes > 0;
  }

  getCategoryLabels(organizationId: string): Record<string, string> {
    const rows = this.db
      .prepare("SELECT id, name FROM categories WHERE organization_id = ?")
      .all(organizationId) as { id: string; name: string }[];
    const map: Record<string, string> = {};
    for (const row of rows) map[row.id] = row.name;
    return map;
  }

  // ==================== ARTICLES ====================

  getAllArticles(): Article[] {
    const rows = this.db
      .prepare(
        "SELECT id, category_id, name, description, unit, stock_quantity, stock_min, created_at FROM articles ORDER BY name",
      )
      .all() as ArticleRow[];
    return rows.map(mapArticle);
  }

  getArticlesByCategory(categoryId: string): Article[] {
    const rows = this.db
      .prepare(
        "SELECT id, category_id, name, description, unit, stock_quantity, stock_min, created_at FROM articles WHERE category_id = ? ORDER BY name",
      )
      .all(categoryId) as ArticleRow[];
    return rows.map(mapArticle);
  }

  getArticle(id: string): Article | null {
    const r = this.db
      .prepare(
        "SELECT id, category_id, name, description, unit, stock_quantity, stock_min, created_at FROM articles WHERE id = ?",
      )
      .get(id) as ArticleRow | undefined;
    return r ? mapArticle(r) : null;
  }

  createArticle(input: CreateArticleInput): Article {
    const id = "art-" + generateId();
    const createdAt = now();
    this.db
      .prepare(
        "INSERT INTO articles (id, category_id, name, description, unit, stock_quantity, stock_min, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        id,
        input.categoryId,
        input.name,
        input.description ?? "",
        input.unit ?? "unités",
        input.stockQuantity ?? 0,
        input.stockMin ?? 0,
        createdAt,
      );
    return mapArticle({
      id,
      category_id: input.categoryId,
      name: input.name,
      description: input.description ?? "",
      unit: input.unit ?? "unités",
      stock_quantity: input.stockQuantity ?? 0,
      stock_min: input.stockMin ?? 0,
      created_at: createdAt,
    });
  }

  updateArticle(
    id: string,
    input: Partial<Omit<CreateArticleInput, "categoryId">>,
  ): Article | null {
    const r = this.db
      .prepare(
        "SELECT id, category_id, name, description, unit, stock_quantity, stock_min, created_at FROM articles WHERE id = ?",
      )
      .get(id) as ArticleRow | undefined;
    if (!r) return null;
    const name = input.name ?? r.name;
    const description =
      input.description !== undefined ? input.description : r.description;
    const unit = input.unit ?? r.unit;
    const stockQuantity =
      input.stockQuantity !== undefined
        ? input.stockQuantity
        : r.stock_quantity;
    const stockMin =
      input.stockMin !== undefined ? input.stockMin : r.stock_min;
    this.db
      .prepare(
        "UPDATE articles SET name = ?, description = ?, unit = ?, stock_quantity = ?, stock_min = ? WHERE id = ?",
      )
      .run(name, description ?? "", unit, stockQuantity, stockMin, id);
    return mapArticle({
      ...r,
      name,
      description: description ?? "",
      unit,
      stock_quantity: stockQuantity,
      stock_min: stockMin,
    });
  }

  deleteArticle(id: string): boolean {
    return (
      this.db.prepare("DELETE FROM articles WHERE id = ?").run(id).changes > 0
    );
  }

  adjustArticleStock(articleId: string, delta: number): Article | null {
    const r = this.db
      .prepare(
        "SELECT id, category_id, name, description, unit, stock_quantity, stock_min, created_at FROM articles WHERE id = ?",
      )
      .get(articleId) as ArticleRow | undefined;
    if (!r) return null;
    const stockQuantity = Math.max(0, r.stock_quantity + delta);
    this.db
      .prepare("UPDATE articles SET stock_quantity = ? WHERE id = ?")
      .run(stockQuantity, articleId);
    return mapArticle({ ...r, stock_quantity: stockQuantity });
  }

  // ==================== FAMILIES ====================

  getAllFamilies(organizationId: string): Family[] {
    return this.familyService.getAllFamilies(organizationId);
  }

  getFamiliesPage(
    organizationId: string,
    opts: { limit: number; offset: number; search?: string },
  ): { items: Family[]; total: number } {
    return this.familyService.getFamiliesPage(organizationId, opts);
  }

  getFamiliesByIds(organizationId: string, ids: string[]): Family[] {
    return this.familyService.getFamiliesByIds(organizationId, ids);
  }

  getFamily(organizationId: string, id: string): Family | null {
    return this.familyService.getFamily(organizationId, id);
  }

  createFamily(organizationId: string, input: CreateFamilyInput): Family {
    return this.familyService.createFamily(organizationId, input);
  }

  updateFamily(
    organizationId: string,
    id: string,
    input: Partial<CreateFamilyInput>,
  ): Family | null {
    return this.familyService.updateFamily(organizationId, id, input);
  }

  deleteFamily(organizationId: string, id: string): boolean {
    return this.familyService.deleteFamily(organizationId, id);
  }

  purgeArchivedFamilies(organizationId: string): number {
    return this.familyService.purgeArchivedFamilies(organizationId);
  }

  resetAllFamilies(organizationId: string): number {
    return this.familyService.resetAllFamilies(organizationId);
  }

  searchFamilies(organizationId: string, query: string, limit?: number): Family[] {
    return this.familyService.searchFamilies(organizationId, query, limit);
  }

  searchGlobal(organizationId: string, query: string, limit = 100): {
    families: Family[];
    needs: Need[];
    aids: Aid[];
  } {
    const q = query.trim().toLowerCase();
    if (!q) return { families: [], needs: [], aids: [] };
    
    const categoryLabels = this.getCategoryLabels(organizationId);
    const families = this.searchFamilies(organizationId, query, limit);
    const like = `%${q.replace(/%/g, "\\%")}%`;

    // Trouver les IDs de catégories dont le nom correspond à la requête
    const matchingCategoryIds = Object.entries(categoryLabels)
      .filter(([_, label]) => label.toLowerCase().includes(q))
      .map(([id]) => id);

    // Construire les conditions de recherche pour needs
    const needConditions: string[] = [];
    const needParams: unknown[] = [];

    // Condition sur les familles (seulement si des familles sont trouvées)
    if (families.length > 0) {
      needConditions.push(`family_id IN (${families.map(() => "?").join(",")})`);
      needParams.push(...families.map((f) => f.id));
    }

    // Condition sur les labels de catégories (seulement si des catégories correspondent)
    if (matchingCategoryIds.length > 0) {
      needConditions.push(`type IN (${matchingCategoryIds.map(() => "?").join(",")})`);
      needParams.push(...matchingCategoryIds);
    }

    // Conditions sur les commentaires et détails (toujours présentes → requête jamais vide)
    needConditions.push("lower(comment) LIKE ?");
    needConditions.push("lower(details) LIKE ?");
    needParams.push(like, like);

    const needs = this.db
      .prepare(
        `SELECT * FROM needs WHERE (${needConditions.join(" OR ")}) AND organization_id = ? ORDER BY created_at DESC LIMIT ?`,
      )
      .all(...needParams, organizationId, limit) as NeedRow[];

    // Construire les conditions de recherche pour aids
    const aidConditions: string[] = [];
    const aidParams: unknown[] = [];

    // Condition sur les familles (seulement si des familles sont trouvées)
    if (families.length > 0) {
      aidConditions.push(`family_id IN (${families.map(() => "?").join(",")})`);
      aidParams.push(...families.map((f) => f.id));
    }

    // Condition sur les labels de catégories (seulement si des catégories correspondent)
    if (matchingCategoryIds.length > 0) {
      aidConditions.push(`type IN (${matchingCategoryIds.map(() => "?").join(",")})`);
      aidParams.push(...matchingCategoryIds);
    }

    // Conditions sur le nom du bénévole et les notes
    aidConditions.push("lower(volunteer_name) LIKE ?");
    aidConditions.push("lower(notes) LIKE ?");
    aidParams.push(like, like);

    const aids = this.db
      .prepare(
        `SELECT * FROM aids WHERE (${aidConditions.join(" OR ")}) AND organization_id = ? ORDER BY date DESC LIMIT ?`,
      )
      .all(...aidParams, organizationId, limit) as AidRow[];

    return {
      families,
      needs: needs.map(mapNeed),
      aids: aids.map(mapAid),
    };
  }

  // ==================== CHILDREN ====================

  getChildrenByFamily(familyId: string): Child[] {
    const rows = this.db
      .prepare("SELECT * FROM children WHERE family_id = ? ORDER BY created_at")
      .all(familyId) as ChildRow[];
    return rows.map(mapChild);
  }

  /** Batch load children by family ids (avoids N+1 in export). */
  getChildrenByFamilyIds(familyIds: string[]): Map<string, Child[]> {
    const map = new Map<string, Child[]>();
    if (familyIds.length === 0) return map;
    const placeholders = familyIds.map(() => "?").join(",");
    const rows = this.db
      .prepare(
        `SELECT * FROM children WHERE family_id IN (${placeholders}) ORDER BY family_id, created_at`,
      )
      .all(...familyIds) as ChildRow[];
    for (const r of rows) {
      const list = map.get(r.family_id) ?? [];
      list.push(mapChild(r));
      map.set(r.family_id, list);
    }
    return map;
  }

  createChild(input: CreateChildInput): Child {
    const id = "ch-" + generateId();
    const createdAt = now();
    this.db
      .prepare(
        "INSERT INTO children (id, family_id, first_name, age, sex, specific_needs, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        id,
        input.familyId,
        input.firstName,
        input.age,
        input.sex,
        input.specificNeeds ?? "",
        createdAt,
      );
    return mapChild({
      id,
      family_id: input.familyId,
      first_name: input.firstName,
      age: input.age,
      sex: input.sex,
      specific_needs: input.specificNeeds ?? "",
      created_at: createdAt,
    });
  }

  updateChild(id: string, input: Partial<CreateChildInput>): Child | null {
    const r = this.db.prepare("SELECT * FROM children WHERE id = ?").get(id) as
      | ChildRow
      | undefined;
    if (!r) return null;
    const firstName = input.firstName ?? r.first_name;
    const age = input.age ?? r.age;
    const sex = input.sex ?? r.sex;
    const specificNeeds =
      input.specificNeeds !== undefined
        ? input.specificNeeds
        : r.specific_needs;
    this.db
      .prepare(
        "UPDATE children SET first_name = ?, age = ?, sex = ?, specific_needs = ? WHERE id = ?",
      )
      .run(firstName, age, sex, specificNeeds ?? "", id);
    return mapChild({
      ...r,
      first_name: firstName,
      age,
      sex,
      specific_needs: specificNeeds ?? "",
    });
  }

  deleteChild(id: string): boolean {
    return (
      this.db.prepare("DELETE FROM children WHERE id = ?").run(id).changes > 0
    );
  }

  // ==================== NEEDS ====================

  getAllNeeds(): Need[] {
    const rows = this.db
      .prepare("SELECT * FROM needs ORDER BY created_at DESC")
      .all() as NeedRow[];
    return rows.map(mapNeed);
  }

  getNeedsPage(
    organizationId: string,
    opts: { limit: number; offset: number; familyId?: string },
  ): { items: Need[]; total: number } {
    const { limit, offset, familyId } = opts;
    const baseSql = familyId
      ? "FROM needs WHERE organization_id = ? AND family_id = ?"
      : "FROM needs WHERE organization_id = ?";
    const params = familyId ? [organizationId, familyId] : [organizationId];
    const countRow = this.db
      .prepare(`SELECT COUNT(*) as c ${baseSql}`)
      .get(...params) as { c: number };
    const rows = this.db
      .prepare(
        `SELECT * ${baseSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as NeedRow[];
    return { total: countRow.c, items: rows.map(mapNeed) };
  }

  getNeedsByFamily(familyId: string): Need[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM needs WHERE family_id = ? ORDER BY created_at DESC",
      )
      .all(familyId) as NeedRow[];
    return rows.map(mapNeed);
  }

  /** Batch load needs by family ids (avoids N+1 in export). */
  getNeedsByFamilyIds(familyIds: string[]): Map<string, Need[]> {
    const map = new Map<string, Need[]>();
    if (familyIds.length === 0) return map;
    const placeholders = familyIds.map(() => "?").join(",");
    const rows = this.db
      .prepare(
        `SELECT * FROM needs WHERE family_id IN (${placeholders}) ORDER BY family_id, created_at DESC`,
      )
      .all(...familyIds) as NeedRow[];
    for (const r of rows) {
      const list = map.get(r.family_id) ?? [];
      list.push(mapNeed(r));
      map.set(r.family_id, list);
    }
    return map;
  }

  createNeed(input: CreateNeedInput): Need {
    const id = "nd-" + generateId();
    const createdAt = now();
    const status = input.status ?? "pending";
    this.db
      .prepare(
        "INSERT INTO needs (id, family_id, type, urgency, status, comment, details, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        id,
        input.familyId,
        input.type,
        input.urgency,
        status,
        input.comment ?? "",
        input.details ?? "",
        createdAt,
        createdAt,
      );
    return mapNeed({
      id,
      family_id: input.familyId,
      type: input.type,
      urgency: input.urgency,
      status,
      comment: input.comment ?? "",
      details: input.details ?? "",
      created_at: createdAt,
      updated_at: createdAt,
    });
  }

  updateNeed(
    id: string,
    input: Partial<CreateNeedInput & { status: string }>,
  ): Need | null {
    const r = this.db.prepare("SELECT * FROM needs WHERE id = ?").get(id) as
      | NeedRow
      | undefined;
    if (!r) return null;
    const updatedAt = now();
    const type = input.type ?? r.type;
    const urgency = input.urgency ?? r.urgency;
    const status = input.status ?? r.status;
    const comment = input.comment !== undefined ? input.comment : r.comment;
    const details = input.details !== undefined ? input.details : r.details;
    this.db
      .prepare(
        "UPDATE needs SET type = ?, urgency = ?, status = ?, comment = ?, details = ?, updated_at = ? WHERE id = ?",
      )
      .run(type, urgency, status, comment ?? "", details ?? "", updatedAt, id);
    return mapNeed({
      ...r,
      type,
      urgency,
      status,
      comment: comment ?? "",
      details: details ?? "",
      updated_at: updatedAt,
    });
  }

  deleteNeed(id: string): boolean {
    return (
      this.db.prepare("DELETE FROM needs WHERE id = ?").run(id).changes > 0
    );
  }

  // ==================== AIDS ====================

  getAllAids(): Aid[] {
    const rows = this.db
      .prepare("SELECT * FROM aids ORDER BY date DESC")
      .all() as AidRow[];
    return rows.map(mapAid);
  }

  getAidsPage(
    organizationId: string,
    opts: { limit: number; offset: number; familyId?: string },
  ): { items: Aid[]; total: number } {
    const { limit, offset, familyId } = opts;
    const baseSql = familyId
      ? "FROM aids WHERE organization_id = ? AND family_id = ?"
      : "FROM aids WHERE organization_id = ?";
    const params = familyId ? [organizationId, familyId] : [organizationId];
    const countRow = this.db
      .prepare(`SELECT COUNT(*) as c ${baseSql}`)
      .get(...params) as { c: number };
    const rows = this.db
      .prepare(
        `SELECT * ${baseSql} ORDER BY date DESC LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as AidRow[];
    return { total: countRow.c, items: rows.map(mapAid) };
  }

  getAidsByFamily(familyId: string): Aid[] {
    const rows = this.db
      .prepare("SELECT * FROM aids WHERE family_id = ? ORDER BY date DESC")
      .all(familyId) as AidRow[];
    return rows.map(mapAid);
  }

  /** Batch load aids by family ids (avoids N+1 in export). */
  getAidsByFamilyIds(familyIds: string[]): Map<string, Aid[]> {
    const map = new Map<string, Aid[]>();
    if (familyIds.length === 0) return map;
    const placeholders = familyIds.map(() => "?").join(",");
    const rows = this.db
      .prepare(
        `SELECT * FROM aids WHERE family_id IN (${placeholders}) ORDER BY family_id, date DESC`,
      )
      .all(...familyIds) as AidRow[];
    for (const r of rows) {
      const list = map.get(r.family_id) ?? [];
      list.push(mapAid(r));
      map.set(r.family_id, list);
    }
    return map;
  }

  createAid(input: CreateAidStorageInput): Aid {
    // Protection simple contre les doubles soumissions proches dans le temps
    const recentDuplicate = this.db
      .prepare(
        `SELECT * FROM aids
         WHERE family_id = ?
           AND type = ?
           AND IFNULL(article_id, '') = IFNULL(?, '')
           AND quantity = ?
           AND date = ?
           AND volunteer_id = ?
           AND source = ?
           AND notes = ?
         ORDER BY created_at DESC
         LIMIT 1`,
      )
      .get(
        input.familyId,
        input.type,
        input.articleId ?? "",
        input.quantity ?? 1,
        input.date || "",
        input.volunteerId,
        input.source,
        input.notes ?? "",
      ) as AidRow | undefined;

    if (recentDuplicate) {
      const createdTime = new Date(recentDuplicate.created_at).getTime();
      if (Date.now() - createdTime < 10_000) {
        return mapAid(recentDuplicate);
      }
    }

    const id = "aid-" + generateId();
    const createdAt = now();
    const date = input.date || now();

    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          "INSERT INTO aids (id, family_id, type, article_id, quantity, date, volunteer_id, volunteer_name, source, notes, proof_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          id,
          input.familyId,
          input.type,
          input.articleId ?? "",
          input.quantity ?? 1,
          date,
          input.volunteerId,
          input.volunteerName,
          input.source,
          input.notes ?? "",
          input.proofUrl ?? "",
          createdAt,
        );

      this.db
        .prepare(
          "UPDATE families SET last_visit_at = ?, updated_at = ? WHERE id = ?",
        )
        .run(date, now(), input.familyId);

      if (input.articleId) {
        const art = this.db
          .prepare("SELECT stock_quantity FROM articles WHERE id = ?")
          .get(input.articleId) as { stock_quantity: number } | undefined;
        if (art) {
          const newQty = Math.max(
            0,
            art.stock_quantity - (input.quantity ?? 1),
          );
          this.db
            .prepare("UPDATE articles SET stock_quantity = ? WHERE id = ?")
            .run(newQty, input.articleId);
        }
      }

      const matchingNeeds = this.db
        .prepare(
          "SELECT * FROM needs WHERE family_id = ? AND type = ? AND status != ?",
        )
        .all(input.familyId, input.type, "covered") as NeedRow[];
      const upd = now();
      for (const need of matchingNeeds) {
        const newStatus = need.status === "pending" ? "partial" : "covered";
        this.db
          .prepare("UPDATE needs SET status = ?, updated_at = ? WHERE id = ?")
          .run(newStatus, upd, need.id);
      }
    });

    tx();

    const row = this.db
      .prepare("SELECT * FROM aids WHERE id = ?")
      .get(id) as AidRow;
    return mapAid(row);
  }

  deleteAid(id: string): boolean {
    return (
      this.db.prepare("DELETE FROM aids WHERE id = ?").run(id).changes > 0
    );
  }

  // ==================== VISIT NOTES ====================

  getNotesByFamily(familyId: string): VisitNote[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM visit_notes WHERE family_id = ? ORDER BY date DESC",
      )
      .all(familyId) as VisitNoteRow[];
    return rows.map(mapVisitNote);
  }

  createVisitNote(input: CreateVisitNoteStorageInput): VisitNote {
    // Protection contre les doubles soumissions de notes très rapprochées
    const recentDuplicate = this.db
      .prepare(
        `SELECT * FROM visit_notes
         WHERE family_id = ?
           AND volunteer_id = ?
           AND content = ?
           AND date = ?
         ORDER BY created_at DESC
         LIMIT 1`,
      )
      .get(
        input.familyId,
        input.volunteerId,
        input.content,
        input.date,
      ) as VisitNoteRow | undefined;

    if (recentDuplicate) {
      const createdTime = new Date(recentDuplicate.created_at).getTime();
      if (Date.now() - createdTime < 10_000) {
        return mapVisitNote(recentDuplicate);
      }
    }

    const id = "vn-" + generateId();
    const createdAt = now();
    this.db
      .prepare(
        "INSERT INTO visit_notes (id, family_id, volunteer_id, volunteer_name, content, date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        id,
        input.familyId,
        input.volunteerId,
        input.volunteerName,
        input.content,
        input.date,
        createdAt,
      );
    this.db
      .prepare(
        "UPDATE families SET last_visit_at = ?, updated_at = ? WHERE id = ?",
      )
      .run(input.date, now(), input.familyId);
    return mapVisitNote({
      id,
      family_id: input.familyId,
      volunteer_id: input.volunteerId,
      volunteer_name: input.volunteerName,
      content: input.content,
      date: input.date,
      created_at: createdAt,
    });
  }

  // ==================== DASHBOARD ====================

  getDashboardStats(organizationId: string): DashboardStats {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const totalFamilies = (
      this.db
        .prepare("SELECT COUNT(*) as c FROM families WHERE archived = 0 AND organization_id = ?")
        .get(organizationId) as { c: number }
    ).c;
    const urgentNeeds = (
      this.db
        .prepare(
          "SELECT COUNT(*) as c FROM needs WHERE organization_id = ? AND urgency = 'high' AND status != 'covered'",
        )
        .get(organizationId) as { c: number }
    ).c;
    const aidsThisMonth = (
      this.db
        .prepare("SELECT COUNT(*) as c FROM aids WHERE organization_id = ? AND date >= ?")
        .get(organizationId, startOfMonth.toISOString()) as { c: number }
    ).c;
    const familiesNotVisited = (
      this.db
        .prepare(
          "SELECT COUNT(*) as c FROM families WHERE archived = 0 AND organization_id = ? AND (last_visit_at IS NULL OR last_visit_at < ?)",
        )
        .get(organizationId, thirtyDaysAgo.toISOString()) as { c: number }
    ).c;
    const medicalFamilies = (
      this.db
        .prepare(
          "SELECT COUNT(*) as c FROM families WHERE organization_id = ? AND has_medical_needs = 1 AND archived = 0",
        )
        .get(organizationId) as { c: number }
    ).c;
    const recentAidsRows = this.db
      .prepare("SELECT * FROM aids WHERE organization_id = ? ORDER BY date DESC LIMIT 5")
      .all(organizationId) as AidRow[];
    const urgentNeedsRows = this.db
      .prepare(
        "SELECT * FROM needs WHERE organization_id = ? AND urgency = 'high' AND status != 'covered' ORDER BY created_at DESC LIMIT 5",
      )
      .all(organizationId) as NeedRow[];
    const familyIds = [...new Set([
      ...recentAidsRows.map((a) => a.family_id),
      ...urgentNeedsRows.map((n) => n.family_id),
    ])];
    const familyMap = Object.fromEntries(
      this.familyService.getFamiliesByIds(organizationId, familyIds).map((f) => [f.id, f]),
    );
    const recentAids = recentAidsRows.map((a) => {
      const fam = familyMap[a.family_id];
      return {
        ...mapAid(a),
        familyName: fam?.number ? `Famille N° ${fam.number}` : fam?.responsibleName ?? "Inconnu",
      };
    });
    const urgentNeedsList = urgentNeedsRows.map((n) => {
      const fam = familyMap[n.family_id];
      return {
        ...mapNeed(n),
        familyName: fam?.number ? `Famille N° ${fam.number}` : fam?.responsibleName ?? "Inconnu",
      };
    });
    return {
      totalFamilies,
      urgentNeeds,
      aidsThisMonth,
      familiesNotVisited,
      medicalFamilies,
      recentAids,
      urgentNeedsList,
    };
  }

  // ==================== EXPORT ====================

  getExportData(organizationId: string, opts?: { limit?: number; offset?: number }) {
    const limit = opts?.limit ?? 200;
    const offset = opts?.offset ?? 0;

    const familiesRows = this.db
      .prepare(
        "SELECT * FROM families WHERE archived = 0 AND organization_id = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?",
      )
      .all(organizationId, limit, offset) as FamilyRow[];
    const families = familiesRows.map(mapFamilyRow);
    const familyIds = families.map((f) => f.id);
    const childrenByFamily = this.getChildrenByFamilyIds(familyIds);
    const needsByFamily = this.getNeedsByFamilyIds(familyIds);
    const aidsByFamily = this.getAidsByFamilyIds(familyIds);

    const familiesWithRelations = families.map((f) => ({
      ...f,
      children: childrenByFamily.get(f.id) ?? [],
      needs: needsByFamily.get(f.id) ?? [],
      aids: aidsByFamily.get(f.id) ?? [],
    }));

    const totalFamiliesRow = this.db
      .prepare("SELECT COUNT(*) as c FROM families WHERE archived = 0 AND organization_id = ?")
      .get(organizationId) as { c: number };

    return {
      families: familiesWithRelations,
      stats: this.getDashboardStats(organizationId),
      pagination: {
        limit,
        offset,
        totalFamilies: totalFamiliesRow.c,
      },
    };
  }

  // ==================== AUDIT LOG ====================

  appendAuditLog(
    organizationId: string,
    entry: {
      userId: string;
      userName: string;
      action: "created" | "updated" | "deleted";
      entityType: AuditLog["entityType"];
      entityId: string;
      details?: string;
    },
  ): AuditLog {
    const id = "audit-" + generateId();
    const createdAt = now();
    this.db
      .prepare(
        "INSERT INTO audit_logs (id, organization_id, user_id, user_name, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        id,
        organizationId,
        entry.userId,
        entry.userName,
        entry.action,
        entry.entityType,
        entry.entityId,
        entry.details ?? null,
        createdAt,
      );
    return mapAuditLog({
      id,
      user_id: entry.userId,
      user_name: entry.userName,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      details: entry.details ?? null,
      created_at: createdAt,
    });
  }

  getAuditLogs(organizationId: string, limit = 100): AuditLog[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM audit_logs WHERE organization_id = ? ORDER BY created_at DESC LIMIT ?",
      )
      .all(organizationId, limit) as AuditLogRow[];
    return rows.map(mapAuditLog);
  }

  pruneAuditLogsOlderThan(organizationId: string, retentionDays: number): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    const cutoffIso = cutoff.toISOString();
    const info = this.db
      .prepare(
        "DELETE FROM audit_logs WHERE organization_id = ? AND created_at < ?",
      )
      .run(organizationId, cutoffIso);
    return info.changes ?? 0;
  }

  // ==================== FAMILY DOCUMENTS ====================

  getDocumentsByFamily(familyId: string): FamilyDocument[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM family_documents WHERE family_id = ? ORDER BY uploaded_at DESC",
      )
      .all(familyId) as FamilyDocumentRow[];
    return rows.map(mapFamilyDocument);
  }

  /**
   * Crée uniquement l'enregistrement de document en base, en supposant que
   * le fichier lui-même a déjà été envoyé dans le stockage objet.
   */
  createFamilyDocumentRecord(input: {
    familyId: string;
    name: string;
    documentType: CreateFamilyDocumentInput["documentType"];
    mimeType: string;
    fileKey: string;
    uploadedBy: string;
    uploadedByName: string;
  }): FamilyDocument {
    // Idempotence best-effort : si un document identique vient d'être créé,
    // on le renvoie au lieu d'insérer un doublon.
    const tenSecondsAgo = new Date(Date.now() - 10_000).toISOString();
    const existing = this.db
      .prepare(
        `SELECT * FROM family_documents
         WHERE family_id = ?
           AND name = ?
           AND document_type = ?
           AND uploaded_by = ?
           AND uploaded_at >= ?
         ORDER BY uploaded_at DESC
         LIMIT 1`,
      )
      .get(
        input.familyId,
        input.name,
        input.documentType,
        input.uploadedBy,
        tenSecondsAgo,
      ) as FamilyDocumentRow | undefined;

    if (existing) {
      return mapFamilyDocument(existing);
    }

    const id = "doc-" + generateId();
    const uploadedAt = now();
    this.db
      .prepare(
        "INSERT INTO family_documents (id, family_id, name, document_type, file_data, mime_type, uploaded_at, uploaded_by, uploaded_by_name, file_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        id,
        input.familyId,
        input.name,
        input.documentType,
        null, // stockage objet via file_key, plus de BLOB en base
        input.mimeType,
        uploadedAt,
        input.uploadedBy,
        input.uploadedByName,
        input.fileKey,
      );
    return mapFamilyDocument({
      id,
      family_id: input.familyId,
      name: input.name,
      document_type: input.documentType,
      file_data: null,
      mime_type: input.mimeType,
      uploaded_at: uploadedAt,
      uploaded_by: input.uploadedBy,
      uploaded_by_name: input.uploadedByName,
      file_key: input.fileKey,
    });
  }

  getFamilyDocument(id: string): FamilyDocument | null {
    const row = this.db
      .prepare("SELECT * FROM family_documents WHERE id = ?")
      .get(id) as FamilyDocumentRow | undefined;
    return row ? mapFamilyDocument(row) : null;
  }

  deleteFamilyDocument(id: string): boolean {
    return (
      this.db.prepare("DELETE FROM family_documents WHERE id = ?").run(id)
        .changes > 0
    );
  }
}

export { Storage };
export const storage = new Storage();
