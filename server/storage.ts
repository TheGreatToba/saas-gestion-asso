import type {
  User,
  Family,
  Organization,
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
  AuditAction,
  FamilyDocument,
  CreateFamilyDocumentInput,
  Intervention,
  CreateInterventionInput,
  InterventionChecklistItem,
} from "../shared/schema";
import { createHash, randomBytes } from "node:crypto";
import { getDb } from "./db";
import type Database from "better-sqlite3";
import { hashPassword, isPasswordHash, verifyPassword } from "./passwords";
import { FamiliesRepository, mapFamilyRow, type FamilyRow } from "./repositories/families.repository";
import { FamilyService } from "./services/family.service";
import { ChildrenRepository } from "./repositories/children.repository";
import { NeedsRepository, mapNeedRow, type NeedRow } from "./repositories/needs.repository";
import { AidsRepository, mapAidRow, type AidRow } from "./repositories/aids.repository";
import { UsersRepository } from "./repositories/users.repository";
import { InterventionsRepository } from "./repositories/interventions.repository";
import { AuditRepository } from "./repositories/audit.repository";
import { DocumentsRepository } from "./repositories/documents.repository";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

function now(): string {
  return new Date().toISOString();
}

// --- Row mappers (DB snake_case -> schema camelCase) ---
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


class Storage {
  private testDb?: Database.Database;
  private familiesRepo: FamiliesRepository;
  private familyService: FamilyService;
  private childrenRepo: ChildrenRepository;
  private needsRepo: NeedsRepository;
  private aidsRepo: AidsRepository;
  private usersRepo: UsersRepository;
  private interventionsRepo: InterventionsRepository;
  private auditRepo: AuditRepository;
  private documentsRepo: DocumentsRepository;

  constructor(testDb?: Database.Database) {
    this.testDb = testDb;
    const getDbInstance = () => this.testDb ?? getDb();
    this.familiesRepo = new FamiliesRepository(getDbInstance);
    this.familyService = new FamilyService(this.familiesRepo);
    this.childrenRepo = new ChildrenRepository(getDbInstance);
    this.needsRepo = new NeedsRepository(getDbInstance);
    this.aidsRepo = new AidsRepository(getDbInstance);
    this.usersRepo = new UsersRepository(getDbInstance);
    this.interventionsRepo = new InterventionsRepository(getDbInstance);
    this.auditRepo = new AuditRepository(getDbInstance);
    this.documentsRepo = new DocumentsRepository(getDbInstance);
  }

  private get db(): Database.Database {
    return this.testDb ?? getDb();
  }

  // ==================== ORGANIZATIONS ====================

  getOrganization(id: string): Organization | null {
    const r = this.db
      .prepare("SELECT id, name, slug, created_at FROM organizations WHERE id = ?")
      .get(id) as { id: string; name: string; slug: string; created_at: string } | undefined;
    return r
      ? {
          id: r.id,
          name: r.name,
          slug: r.slug,
          createdAt: r.created_at,
        }
      : null;
  }

  // ==================== AUTH ====================

  authenticate(
    email: string,
    password: string,
  ): { user: User | null; error?: "disabled" } {
    const user = this.usersRepo.getByEmail(email);
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
    return { user };
  }

  getUser(id: string): User | null {
    return this.usersRepo.getById(id);
  }

  getAllUsers(organizationId: string): User[] {
    return this.usersRepo.getAllByOrg(organizationId);
  }

  getUserByEmail(email: string): User | null {
    return this.usersRepo.getByEmail(email);
  }

  countActiveAdmins(organizationId: string): number {
    return this.usersRepo.countActiveAdmins(organizationId);
  }

  createUser(input: CreateUserInput, organizationId: string): User {
    return this.usersRepo.create(
      organizationId,
      input,
      hashPassword(input.password),
    );
  }

  updateUser(id: string, input: UpdateUserInput): User | null {
    return this.usersRepo.update(
      id,
      input,
      input.password ? hashPassword(input.password) : undefined,
    );
  }

  deleteUser(id: string): boolean {
    return this.usersRepo.delete(id);
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
    const placeholderPassword = hashPassword(randomBytes(32).toString("hex"));
    return this.usersRepo.createForInvite(
      organizationId,
      input,
      placeholderPassword,
    );
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

  private defaultOrg(): string {
    return "org-default";
  }

  getAllCategories(organizationId: string): Category[] {
    const org = organizationId || this.defaultOrg();
    const rows = this.db
      .prepare(
        "SELECT id, name, description, created_at FROM categories WHERE organization_id = ? ORDER BY name",
      )
      .all(org) as CategoryRow[];
    return rows.map(mapCategory);
  }

  getCategory(id: string, organizationId: string): Category | null {
    const org = organizationId || this.defaultOrg();
    const r = this.db
      .prepare(
        "SELECT id, name, description, created_at FROM categories WHERE id = ? AND organization_id = ?",
      )
      .get(id, org) as CategoryRow | undefined;
    return r ? mapCategory(r) : null;
  }

  createCategory(organizationId: string, input: CreateCategoryInput): Category {
    const org = organizationId || this.defaultOrg();
    const slug = input.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    let id = slug || "cat-" + generateId();
    const existing = this.db
      .prepare("SELECT 1 FROM categories WHERE id = ? AND organization_id = ?")
      .get(id, org);
    if (existing) id = id + "-" + generateId();
    const createdAt = now();
    this.db
      .prepare(
        "INSERT INTO categories (id, name, description, created_at, organization_id) VALUES (?, ?, ?, ?, ?)",
      )
      .run(id, input.name, input.description ?? "", createdAt, org);
    return {
      id,
      name: input.name,
      description: input.description ?? "",
      createdAt,
    };
  }

  updateCategory(
    id: string,
    organizationId: string,
    input: Partial<CreateCategoryInput>,
  ): Category | null {
    const org = organizationId || this.defaultOrg();
    const r = this.db
      .prepare(
        "SELECT id, name, description, created_at FROM categories WHERE id = ? AND organization_id = ?",
      )
      .get(id, org) as CategoryRow | undefined;
    if (!r) return null;
    const name = input.name ?? r.name;
    const description =
      input.description !== undefined ? input.description : r.description;
    this.db
      .prepare("UPDATE categories SET name = ?, description = ? WHERE id = ? AND organization_id = ?")
      .run(name, description ?? "", id, org);
    return mapCategory({ ...r, name, description: description ?? "" });
  }

  deleteCategory(id: string, organizationId: string): boolean {
    const org = organizationId || this.defaultOrg();
    const info = this.db
      .prepare("DELETE FROM categories WHERE id = ? AND organization_id = ?")
      .run(id, org);
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

  getAllArticles(organizationId: string): Article[] {
    const org = organizationId || this.defaultOrg();
    const rows = this.db
      .prepare(
        "SELECT id, category_id, name, description, unit, stock_quantity, stock_min, created_at FROM articles WHERE organization_id = ? ORDER BY name",
      )
      .all(org) as ArticleRow[];
    return rows.map(mapArticle);
  }

  getArticlesByCategory(categoryId: string, organizationId: string): Article[] {
    const org = organizationId || this.defaultOrg();
    const rows = this.db
      .prepare(
        "SELECT id, category_id, name, description, unit, stock_quantity, stock_min, created_at FROM articles WHERE category_id = ? AND organization_id = ? ORDER BY name",
      )
      .all(categoryId, org) as ArticleRow[];
    return rows.map(mapArticle);
  }

  getArticle(id: string, organizationId: string): Article | null {
    const org = organizationId || this.defaultOrg();
    const r = this.db
      .prepare(
        "SELECT id, category_id, name, description, unit, stock_quantity, stock_min, created_at FROM articles WHERE id = ? AND organization_id = ?",
      )
      .get(id, org) as ArticleRow | undefined;
    return r ? mapArticle(r) : null;
  }

  createArticle(organizationId: string, input: CreateArticleInput): Article {
    const org = organizationId || this.defaultOrg();
    if (!this.getCategory(input.categoryId, org)) {
      throw new Error("Catégorie non trouvée dans cette organisation");
    }
    const id = "art-" + generateId();
    const createdAt = now();
    this.db
      .prepare(
        "INSERT INTO articles (id, category_id, name, description, unit, stock_quantity, stock_min, created_at, organization_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
        org,
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
    organizationId: string,
    input: Partial<Omit<CreateArticleInput, "categoryId">>,
  ): Article | null {
    const org = organizationId || this.defaultOrg();
    const r = this.db
      .prepare(
        "SELECT id, category_id, name, description, unit, stock_quantity, stock_min, created_at FROM articles WHERE id = ? AND organization_id = ?",
      )
      .get(id, org) as ArticleRow | undefined;
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
        "UPDATE articles SET name = ?, description = ?, unit = ?, stock_quantity = ?, stock_min = ? WHERE id = ? AND organization_id = ?",
      )
      .run(name, description ?? "", unit, stockQuantity, stockMin, id, org);
    return mapArticle({
      ...r,
      name,
      description: description ?? "",
      unit,
      stock_quantity: stockQuantity,
      stock_min: stockMin,
    });
  }

  deleteArticle(id: string, organizationId: string): boolean {
    const org = organizationId || this.defaultOrg();
    return this.db
      .prepare("DELETE FROM articles WHERE id = ? AND organization_id = ?")
      .run(id, org).changes > 0;
  }

  adjustArticleStock(articleId: string, organizationId: string, delta: number): Article | null {
    const org = organizationId || this.defaultOrg();
    const r = this.db
      .prepare(
        "SELECT id, category_id, name, description, unit, stock_quantity, stock_min, created_at FROM articles WHERE id = ? AND organization_id = ?",
      )
      .get(articleId, org) as ArticleRow | undefined;
    if (!r) return null;
    const stockQuantity = Math.max(0, r.stock_quantity + delta);
    this.db
      .prepare("UPDATE articles SET stock_quantity = ? WHERE id = ? AND organization_id = ?")
      .run(stockQuantity, articleId, org);
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
      needs: needs.map(mapNeedRow),
      aids: aids.map(mapAidRow),
    };
  }

  // ==================== CHILDREN ====================

  getChild(id: string): Child | null {
    return this.childrenRepo.getById(id);
  }

  getChildrenByFamily(familyId: string): Child[] {
    return this.childrenRepo.getByFamily(familyId);
  }

  /** Batch load children by family ids (avoids N+1 in export). */
  getChildrenByFamilyIds(familyIds: string[]): Map<string, Child[]> {
    return this.childrenRepo.getByFamilyIds(familyIds);
  }

  createChild(input: CreateChildInput): Child {
    return this.childrenRepo.create(input);
  }

  updateChild(id: string, input: Partial<CreateChildInput>): Child | null {
    return this.childrenRepo.update(id, input);
  }

  deleteChild(id: string): boolean {
    return this.childrenRepo.delete(id);
  }

  // ==================== NEEDS ====================

  getNeedsPage(
    organizationId: string,
    opts: { limit: number; offset: number; familyId?: string },
  ): { items: Need[]; total: number } {
    return this.needsRepo.getPage(organizationId, opts);
  }

  getNeedsByFamily(familyId: string): Need[] {
    return this.needsRepo.getByFamily(familyId);
  }

  /** Batch load needs by family ids (avoids N+1 in export). */
  getNeedsByFamilyIds(familyIds: string[]): Map<string, Need[]> {
    return this.needsRepo.getByFamilyIds(familyIds);
  }

  createNeed(organizationId: string, input: CreateNeedInput): Need {
    return this.needsRepo.create(organizationId, input);
  }

  updateNeed(
    id: string,
    organizationId: string,
    input: Partial<CreateNeedInput & { status: string }>,
  ): Need | null {
    return this.needsRepo.update(id, organizationId, input);
  }

  deleteNeed(id: string, organizationId: string): boolean {
    return this.needsRepo.delete(id, organizationId);
  }

  // ==================== INTERVENTIONS ====================

  getInterventionsPage(
    organizationId: string,
    opts: {
      limit: number;
      offset: number;
      status?: string;
      assignedUserId?: string;
    },
  ): { items: Intervention[]; total: number } {
    return this.interventionsRepo.getPage(organizationId, opts);
  }

  getIntervention(id: string, organizationId: string): Intervention | null {
    return this.interventionsRepo.getByIdAndOrg(id, organizationId);
  }

  getMyInterventions(
    organizationId: string,
    userId: string,
    opts?: { status?: string },
  ): Intervention[] {
    return this.interventionsRepo.getByAssignedUser(organizationId, userId, opts);
  }

  createIntervention(
    organizationId: string,
    input: CreateInterventionInput,
  ): Intervention {
    const assigned = this.usersRepo.getById(input.assignedUserId);
    const assignedUserName = assigned?.name ?? "Inconnu";
    return this.interventionsRepo.create(
      organizationId,
      input,
      assignedUserName,
    );
  }

  updateIntervention(
    id: string,
    organizationId: string,
    input: {
      assignedUserId?: string;
      assignedUserName?: string;
      plannedAt?: string;
      checklist?: InterventionChecklistItem[];
      notes?: string;
    },
  ): Intervention | null {
    return this.interventionsRepo.update(id, organizationId, input);
  }

  updateInterventionStatus(
    id: string,
    organizationId: string,
    status: "todo" | "in_progress" | "done",
  ): Intervention | null {
    return this.interventionsRepo.updateStatus(id, organizationId, status);
  }

  updateInterventionChecklist(
    id: string,
    organizationId: string,
    checklist: InterventionChecklistItem[],
  ): Intervention | null {
    return this.interventionsRepo.updateChecklist(id, organizationId, checklist);
  }

  deleteIntervention(id: string, organizationId: string): boolean {
    return this.interventionsRepo.delete(id, organizationId);
  }

  // ==================== AIDS ====================

  getAidsPage(
    organizationId: string,
    opts: { limit: number; offset: number; familyId?: string },
  ): { items: Aid[]; total: number } {
    return this.aidsRepo.getPage(organizationId, opts);
  }

  getAidsByFamily(familyId: string): Aid[] {
    return this.aidsRepo.getByFamily(familyId);
  }

  /** Batch load aids by family ids (avoids N+1 in export). */
  getAidsByFamilyIds(familyIds: string[]): Map<string, Aid[]> {
    return this.aidsRepo.getByFamilyIds(familyIds);
  }

  createAid(organizationId: string, input: CreateAidStorageInput): Aid {
    return this.aidsRepo.create(organizationId, input);
  }

  deleteAid(id: string, organizationId: string): boolean {
    return this.aidsRepo.delete(id, organizationId);
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
        ...mapAidRow(a),
        familyName: fam?.number ? `Famille N° ${fam.number}` : fam?.responsibleName ?? "Inconnu",
      };
    });
    const urgentNeedsList = urgentNeedsRows.map((n) => {
      const fam = familyMap[n.family_id];
      return {
        ...mapNeedRow(n),
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
      action: AuditAction;
      entityType: AuditLog["entityType"];
      entityId: string;
      details?: string;
    },
  ): AuditLog {
    return this.auditRepo.append(organizationId, entry);
  }

  getAuditLogs(organizationId: string, limit = 100): AuditLog[] {
    return this.auditRepo.getByOrganization(organizationId, limit);
  }

  /** Audit logs within a date range (inclusive), for export. */
  getAuditLogsByDateRange(
    organizationId: string,
    fromIso: string,
    toIso: string,
  ): AuditLog[] {
    return this.auditRepo.getByDateRange(organizationId, fromIso, toIso);
  }

  pruneAuditLogsOlderThan(organizationId: string, retentionDays: number): number {
    return this.auditRepo.pruneOlderThan(organizationId, retentionDays);
  }

  // ==================== FAMILY DOCUMENTS ====================

  getDocumentsByFamily(familyId: string): FamilyDocument[] {
    return this.documentsRepo.getByFamily(familyId);
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
    return this.documentsRepo.create(input);
  }

  getFamilyDocument(id: string): FamilyDocument | null {
    return this.documentsRepo.getById(id);
  }

  deleteFamilyDocument(id: string): boolean {
    return this.documentsRepo.delete(id);
  }
}

export { Storage };
export const storage = new Storage();
