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
  CreateAidInput,
  CreateVisitNoteInput,
  CreateCategoryInput,
  CreateArticleInput,
  DashboardStats,
  AuditLog,
  FamilyDocument,
  CreateFamilyDocumentInput,
} from "../shared/schema";
import bcrypt from "bcrypt";
import { getDb } from "./db";
import type Database from "better-sqlite3";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

function now(): string {
  return new Date().toISOString();
}

// --- Row mappers (DB snake_case -> schema camelCase) ---
type UserRow = { id: string; name: string; email: string; role: string };
function mapUser(r: UserRow): User {
  return { id: r.id, name: r.name, email: r.email, role: r.role as User["role"] };
}

type FamilyRow = {
  id: string;
  responsible_name: string;
  phone: string;
  address: string;
  neighborhood: string;
  member_count: number;
  children_count: number;
  housing: string;
  housing_name: string;
  health_notes: string;
  has_medical_needs: number;
  notes: string;
  created_at: string;
  updated_at: string;
  last_visit_at: string | null;
};
function mapFamily(r: FamilyRow): Family {
  return {
    id: r.id,
    responsibleName: r.responsible_name,
    phone: r.phone,
    address: r.address,
    neighborhood: r.neighborhood,
    memberCount: r.member_count,
    childrenCount: r.children_count,
    housing: r.housing as Family["housing"],
    housingName: r.housing_name ?? "",
    healthNotes: r.health_notes ?? "",
    hasMedicalNeeds: !!r.has_medical_needs,
    notes: r.notes ?? "",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    lastVisitAt: r.last_visit_at ?? null,
  };
}

type ChildRow = { id: string; family_id: string; first_name: string; age: number; sex: string; specific_needs: string; created_at: string };
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

type NeedRow = { id: string; family_id: string; type: string; urgency: string; status: string; comment: string; details: string; created_at: string; updated_at: string };
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

type AidRow = { id: string; family_id: string; type: string; article_id: string; quantity: number; date: string; volunteer_id: string; volunteer_name: string; source: string; notes: string; proof_url: string; created_at: string };
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

type VisitNoteRow = { id: string; family_id: string; volunteer_id: string; volunteer_name: string; content: string; date: string; created_at: string };
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

type CategoryRow = { id: string; name: string; description: string; created_at: string };
function mapCategory(r: CategoryRow): Category {
  return { id: r.id, name: r.name, description: r.description ?? "", createdAt: r.created_at };
}

type ArticleRow = { id: string; category_id: string; name: string; description: string; unit: string; stock_quantity: number; stock_min: number; created_at: string };
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

type AuditLogRow = { id: string; user_id: string; user_name: string; action: string; entity_type: string; entity_id: string; details: string | null; created_at: string };
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

type FamilyDocumentRow = { id: string; family_id: string; name: string; document_type: string; file_data: string; mime_type: string; uploaded_at: string; uploaded_by: string; uploaded_by_name: string };
function mapFamilyDocument(r: FamilyDocumentRow): FamilyDocument {
  return {
    id: r.id,
    familyId: r.family_id,
    name: r.name,
    documentType: r.document_type as FamilyDocument["documentType"],
    fileData: r.file_data,
    mimeType: r.mime_type,
    uploadedAt: r.uploaded_at,
    uploadedBy: r.uploaded_by,
    uploadedByName: r.uploaded_by_name,
  };
}

class Storage {
  private get db(): Database.Database {
    return getDb();
  }

  // ==================== AUTH ====================

  authenticate(email: string, password: string): User | null {
    const user = this.db.prepare("SELECT id, name, email, role FROM users WHERE email = ?").get(email) as UserRow | undefined;
    if (!user) return null;
    const row = this.db.prepare("SELECT password FROM passwords WHERE user_id = ?").get(user.id) as { password: string } | undefined;
    if (!row) return null;
    const stored = row.password;
    const valid = stored.startsWith("$2") ? bcrypt.compareSync(password, stored) : stored === password;
    if (!valid) return null;
    // Migrate legacy plain-text password to hash on first successful login
    if (!stored.startsWith("$2")) {
      this.db.prepare("UPDATE passwords SET password = ? WHERE user_id = ?").run(bcrypt.hashSync(password, 10), user.id);
    }
    return mapUser(user);
  }

  getUser(id: string): User | null {
    const r = this.db.prepare("SELECT id, name, email, role FROM users WHERE id = ?").get(id) as UserRow | undefined;
    return r ? mapUser(r) : null;
  }

  getAllUsers(): User[] {
    const rows = this.db.prepare("SELECT id, name, email, role FROM users").all() as UserRow[];
    return rows.map(mapUser);
  }

  // ==================== CATEGORIES ====================

  getAllCategories(): Category[] {
    const rows = this.db.prepare("SELECT id, name, description, created_at FROM categories ORDER BY name").all() as CategoryRow[];
    return rows.map(mapCategory);
  }

  getCategory(id: string): Category | null {
    const r = this.db.prepare("SELECT id, name, description, created_at FROM categories WHERE id = ?").get(id) as CategoryRow | undefined;
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
    const existing = this.db.prepare("SELECT 1 FROM categories WHERE id = ?").get(id);
    if (existing) id = id + "-" + generateId();
    const createdAt = now();
    this.db.prepare("INSERT INTO categories (id, name, description, created_at) VALUES (?, ?, ?, ?)").run(id, input.name, input.description ?? "", createdAt);
    return { id, name: input.name, description: input.description ?? "", createdAt };
  }

  updateCategory(id: string, input: Partial<CreateCategoryInput>): Category | null {
    const r = this.db.prepare("SELECT id, name, description, created_at FROM categories WHERE id = ?").get(id) as CategoryRow | undefined;
    if (!r) return null;
    const name = input.name ?? r.name;
    const description = input.description !== undefined ? input.description : r.description;
    this.db.prepare("UPDATE categories SET name = ?, description = ? WHERE id = ?").run(name, description ?? "", id);
    return mapCategory({ ...r, name, description: description ?? "" });
  }

  deleteCategory(id: string): boolean {
    const info = this.db.prepare("DELETE FROM categories WHERE id = ?").run(id);
    return info.changes > 0;
  }

  getCategoryLabels(): Record<string, string> {
    const rows = this.db.prepare("SELECT id, name FROM categories").all() as { id: string; name: string }[];
    const map: Record<string, string> = {};
    for (const row of rows) map[row.id] = row.name;
    return map;
  }

  // ==================== ARTICLES ====================

  getAllArticles(): Article[] {
    const rows = this.db.prepare("SELECT id, category_id, name, description, unit, stock_quantity, stock_min, created_at FROM articles ORDER BY name").all() as ArticleRow[];
    return rows.map(mapArticle);
  }

  getArticlesByCategory(categoryId: string): Article[] {
    const rows = this.db
      .prepare("SELECT id, category_id, name, description, unit, stock_quantity, stock_min, created_at FROM articles WHERE category_id = ? ORDER BY name")
      .all(categoryId) as ArticleRow[];
    return rows.map(mapArticle);
  }

  getArticle(id: string): Article | null {
    const r = this.db.prepare("SELECT id, category_id, name, description, unit, stock_quantity, stock_min, created_at FROM articles WHERE id = ?").get(id) as ArticleRow | undefined;
    return r ? mapArticle(r) : null;
  }

  createArticle(input: CreateArticleInput): Article {
    const id = "art-" + generateId();
    const createdAt = now();
    this.db
      .prepare(
        "INSERT INTO articles (id, category_id, name, description, unit, stock_quantity, stock_min, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(id, input.categoryId, input.name, input.description ?? "", input.unit ?? "unités", input.stockQuantity ?? 0, input.stockMin ?? 0, createdAt);
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

  updateArticle(id: string, input: Partial<Omit<CreateArticleInput, "categoryId">>): Article | null {
    const r = this.db.prepare("SELECT id, category_id, name, description, unit, stock_quantity, stock_min, created_at FROM articles WHERE id = ?").get(id) as ArticleRow | undefined;
    if (!r) return null;
    const name = input.name ?? r.name;
    const description = input.description !== undefined ? input.description : r.description;
    const unit = input.unit ?? r.unit;
    const stockQuantity = input.stockQuantity !== undefined ? input.stockQuantity : r.stock_quantity;
    const stockMin = input.stockMin !== undefined ? input.stockMin : r.stock_min;
    this.db.prepare("UPDATE articles SET name = ?, description = ?, unit = ?, stock_quantity = ?, stock_min = ? WHERE id = ?").run(name, description ?? "", unit, stockQuantity, stockMin, id);
    return mapArticle({ ...r, name, description: description ?? "", unit, stock_quantity: stockQuantity, stock_min: stockMin });
  }

  deleteArticle(id: string): boolean {
    return this.db.prepare("DELETE FROM articles WHERE id = ?").run(id).changes > 0;
  }

  adjustArticleStock(articleId: string, delta: number): Article | null {
    const r = this.db.prepare("SELECT id, category_id, name, description, unit, stock_quantity, stock_min, created_at FROM articles WHERE id = ?").get(articleId) as ArticleRow | undefined;
    if (!r) return null;
    const stockQuantity = Math.max(0, r.stock_quantity + delta);
    this.db.prepare("UPDATE articles SET stock_quantity = ? WHERE id = ?").run(stockQuantity, articleId);
    return mapArticle({ ...r, stock_quantity: stockQuantity });
  }

  // ==================== FAMILIES ====================

  getAllFamilies(): Family[] {
    const rows = this.db.prepare("SELECT * FROM families ORDER BY updated_at DESC").all() as FamilyRow[];
    return rows.map(mapFamily);
  }

  getFamily(id: string): Family | null {
    const r = this.db.prepare("SELECT * FROM families WHERE id = ?").get(id) as FamilyRow | undefined;
    return r ? mapFamily(r) : null;
  }

  createFamily(input: CreateFamilyInput): Family {
    const id = "fam-" + generateId();
    const createdAt = now();
    const updatedAt = now();
    this.db
      .prepare(
        `INSERT INTO families (id, responsible_name, phone, address, neighborhood, member_count, children_count,
         housing, housing_name, health_notes, has_medical_needs, notes, created_at, updated_at, last_visit_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.responsibleName,
        input.phone,
        input.address,
        input.neighborhood,
        input.memberCount,
        input.childrenCount,
        input.housing,
        input.housingName ?? "",
        input.healthNotes ?? "",
        input.hasMedicalNeeds ? 1 : 0,
        input.notes ?? "",
        createdAt,
        updatedAt,
        null
      );
    return this.getFamily(id)!;
  }

  updateFamily(id: string, input: Partial<CreateFamilyInput>): Family | null {
    const r = this.db.prepare("SELECT * FROM families WHERE id = ?").get(id) as FamilyRow | undefined;
    if (!r) return null;
    const updatedAt = now();
    this.db
      .prepare(
        `UPDATE families SET responsible_name = ?, phone = ?, address = ?, neighborhood = ?, member_count = ?, children_count = ?,
         housing = ?, housing_name = ?, health_notes = ?, has_medical_needs = ?, notes = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        input.responsibleName ?? r.responsible_name,
        input.phone ?? r.phone,
        input.address ?? r.address,
        input.neighborhood ?? r.neighborhood,
        input.memberCount ?? r.member_count,
        input.childrenCount ?? r.children_count,
        input.housing ?? r.housing,
        input.housingName ?? r.housing_name ?? "",
        input.healthNotes ?? r.health_notes ?? "",
        input.hasMedicalNeeds !== undefined ? (input.hasMedicalNeeds ? 1 : 0) : r.has_medical_needs,
        input.notes !== undefined ? input.notes : r.notes,
        updatedAt,
        id
      );
    return this.getFamily(id);
  }

  deleteFamily(id: string): boolean {
    return this.db.prepare("DELETE FROM families WHERE id = ?").run(id).changes > 0;
  }

  searchFamilies(query: string): Family[] {
    const q = "%" + query.toLowerCase().replace(/%/g, "\\%") + "%";
    const rows = this.db
      .prepare(
        `SELECT * FROM families WHERE lower(responsible_name) LIKE ? OR lower(neighborhood) LIKE ? OR lower(housing_name) LIKE ? OR lower(address) LIKE ? OR phone LIKE ?`
      )
      .all(q, q, q, q, query) as FamilyRow[];
    return rows.map(mapFamily);
  }

  searchGlobal(query: string): { families: Family[]; needs: Need[]; aids: Aid[] } {
    const q = query.trim().toLowerCase();
    if (!q) return { families: [], needs: [], aids: [] };
    const categoryLabels = this.getCategoryLabels();
    const families = this.searchFamilies(query);
    const familyIds = new Set(families.map((f) => f.id));
    const allNeeds = this.db.prepare("SELECT * FROM needs").all() as NeedRow[];
    const allAids = this.db.prepare("SELECT * FROM aids").all() as AidRow[];
    const needs = allNeeds.filter((n) => {
      if (familyIds.has(n.family_id)) return true;
      const label = (categoryLabels[n.type] || "").toLowerCase();
      if (label.includes(q)) return true;
      if ((n.comment || "").toLowerCase().includes(q)) return true;
      if ((n.details || "").toLowerCase().includes(q)) return true;
      return false;
    });
    const aids = allAids.filter((a) => {
      if (familyIds.has(a.family_id)) return true;
      const label = (categoryLabels[a.type] || "").toLowerCase();
      if (label.includes(q)) return true;
      if ((a.volunteer_name || "").toLowerCase().includes(q)) return true;
      if ((a.notes || "").toLowerCase().includes(q)) return true;
      return false;
    });
    return {
      families,
      needs: needs.map(mapNeed),
      aids: aids.map(mapAid),
    };
  }

  // ==================== CHILDREN ====================

  getChildrenByFamily(familyId: string): Child[] {
    const rows = this.db.prepare("SELECT * FROM children WHERE family_id = ? ORDER BY created_at").all(familyId) as ChildRow[];
    return rows.map(mapChild);
  }

  createChild(input: CreateChildInput): Child {
    const id = "ch-" + generateId();
    const createdAt = now();
    this.db.prepare("INSERT INTO children (id, family_id, first_name, age, sex, specific_needs, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, input.familyId, input.firstName, input.age, input.sex, input.specificNeeds ?? "", createdAt);
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
    const r = this.db.prepare("SELECT * FROM children WHERE id = ?").get(id) as ChildRow | undefined;
    if (!r) return null;
    const firstName = input.firstName ?? r.first_name;
    const age = input.age ?? r.age;
    const sex = input.sex ?? r.sex;
    const specificNeeds = input.specificNeeds !== undefined ? input.specificNeeds : r.specific_needs;
    this.db.prepare("UPDATE children SET first_name = ?, age = ?, sex = ?, specific_needs = ? WHERE id = ?").run(firstName, age, sex, specificNeeds ?? "", id);
    return mapChild({ ...r, first_name: firstName, age, sex, specific_needs: specificNeeds ?? "" });
  }

  deleteChild(id: string): boolean {
    return this.db.prepare("DELETE FROM children WHERE id = ?").run(id).changes > 0;
  }

  // ==================== NEEDS ====================

  getAllNeeds(): Need[] {
    const rows = this.db.prepare("SELECT * FROM needs ORDER BY created_at DESC").all() as NeedRow[];
    return rows.map(mapNeed);
  }

  getNeedsByFamily(familyId: string): Need[] {
    const rows = this.db.prepare("SELECT * FROM needs WHERE family_id = ? ORDER BY created_at DESC").all(familyId) as NeedRow[];
    return rows.map(mapNeed);
  }

  createNeed(input: CreateNeedInput): Need {
    const id = "nd-" + generateId();
    const createdAt = now();
    const status = input.status ?? "pending";
    this.db
      .prepare("INSERT INTO needs (id, family_id, type, urgency, status, comment, details, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, input.familyId, input.type, input.urgency, status, input.comment ?? "", input.details ?? "", createdAt, createdAt);
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

  updateNeed(id: string, input: Partial<CreateNeedInput & { status: string }>): Need | null {
    const r = this.db.prepare("SELECT * FROM needs WHERE id = ?").get(id) as NeedRow | undefined;
    if (!r) return null;
    const updatedAt = now();
    const type = input.type ?? r.type;
    const urgency = input.urgency ?? r.urgency;
    const status = input.status ?? r.status;
    const comment = input.comment !== undefined ? input.comment : r.comment;
    const details = input.details !== undefined ? input.details : r.details;
    this.db.prepare("UPDATE needs SET type = ?, urgency = ?, status = ?, comment = ?, details = ?, updated_at = ? WHERE id = ?").run(type, urgency, status, comment ?? "", details ?? "", updatedAt, id);
    return mapNeed({ ...r, type, urgency, status, comment: comment ?? "", details: details ?? "", updated_at: updatedAt });
  }

  deleteNeed(id: string): boolean {
    return this.db.prepare("DELETE FROM needs WHERE id = ?").run(id).changes > 0;
  }

  // ==================== AIDS ====================

  getAllAids(): Aid[] {
    const rows = this.db.prepare("SELECT * FROM aids ORDER BY date DESC").all() as AidRow[];
    return rows.map(mapAid);
  }

  getAidsByFamily(familyId: string): Aid[] {
    const rows = this.db.prepare("SELECT * FROM aids WHERE family_id = ? ORDER BY date DESC").all(familyId) as AidRow[];
    return rows.map(mapAid);
  }

  createAid(input: CreateAidInput): Aid {
    const id = "aid-" + generateId();
    const createdAt = now();
    const date = input.date || now();
    this.db
      .prepare(
        "INSERT INTO aids (id, family_id, type, article_id, quantity, date, volunteer_id, volunteer_name, source, notes, proof_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
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
        createdAt
      );
    this.db.prepare("UPDATE families SET last_visit_at = ?, updated_at = ? WHERE id = ?").run(date, now(), input.familyId);
    if (input.articleId) {
      const art = this.db.prepare("SELECT stock_quantity FROM articles WHERE id = ?").get(input.articleId) as { stock_quantity: number } | undefined;
      if (art) {
        const newQty = Math.max(0, art.stock_quantity - (input.quantity ?? 1));
        this.db.prepare("UPDATE articles SET stock_quantity = ? WHERE id = ?").run(newQty, input.articleId);
      }
    }
    const matchingNeeds = this.db.prepare("SELECT * FROM needs WHERE family_id = ? AND type = ? AND status != ?").all(input.familyId, input.type, "covered") as NeedRow[];
    const upd = now();
    for (const need of matchingNeeds) {
      const newStatus = need.status === "pending" ? "partial" : "covered";
      this.db.prepare("UPDATE needs SET status = ?, updated_at = ? WHERE id = ?").run(newStatus, upd, need.id);
    }
    const row = this.db.prepare("SELECT * FROM aids WHERE id = ?").get(id) as AidRow;
    return mapAid(row);
  }

  // ==================== VISIT NOTES ====================

  getNotesByFamily(familyId: string): VisitNote[] {
    const rows = this.db.prepare("SELECT * FROM visit_notes WHERE family_id = ? ORDER BY date DESC").all(familyId) as VisitNoteRow[];
    return rows.map(mapVisitNote);
  }

  createVisitNote(input: CreateVisitNoteInput): VisitNote {
    const id = "vn-" + generateId();
    const createdAt = now();
    this.db
      .prepare("INSERT INTO visit_notes (id, family_id, volunteer_id, volunteer_name, content, date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(id, input.familyId, input.volunteerId, input.volunteerName, input.content, input.date, createdAt);
    this.db.prepare("UPDATE families SET last_visit_at = ?, updated_at = ? WHERE id = ?").run(input.date, now(), input.familyId);
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

  getDashboardStats(): DashboardStats {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const totalFamilies = (this.db.prepare("SELECT COUNT(*) as c FROM families").get() as { c: number }).c;
    const urgentNeeds = (this.db.prepare("SELECT COUNT(*) as c FROM needs WHERE urgency = 'high' AND status != 'covered'").get() as { c: number }).c;
    const aidsThisMonth = (this.db.prepare("SELECT COUNT(*) as c FROM aids WHERE date >= ?").get(startOfMonth.toISOString()) as { c: number }).c;
    const familiesNotVisited = (this.db
      .prepare("SELECT COUNT(*) as c FROM families WHERE last_visit_at IS NULL OR last_visit_at < ?")
      .get(thirtyDaysAgo.toISOString()) as { c: number }).c;
    const medicalFamilies = (this.db.prepare("SELECT COUNT(*) as c FROM families WHERE has_medical_needs = 1").get() as { c: number }).c;
    const recentAidsRows = this.db.prepare("SELECT * FROM aids ORDER BY date DESC LIMIT 5").all() as AidRow[];
    const recentAids = recentAidsRows.map((a) => {
      const fam = this.getFamily(a.family_id);
      return { ...mapAid(a), familyName: fam?.responsibleName ?? "Inconnu" };
    });
    const urgentNeedsRows = this.db.prepare("SELECT * FROM needs WHERE urgency = 'high' AND status != 'covered' ORDER BY created_at DESC LIMIT 5").all() as NeedRow[];
    const urgentNeedsList = urgentNeedsRows.map((n) => {
      const fam = this.getFamily(n.family_id);
      return { ...mapNeed(n), familyName: fam?.responsibleName ?? "Inconnu" };
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

  getExportData() {
    return {
      families: this.getAllFamilies().map((f) => ({
        ...f,
        children: this.getChildrenByFamily(f.id),
        needs: this.getNeedsByFamily(f.id),
        aids: this.getAidsByFamily(f.id),
      })),
      stats: this.getDashboardStats(),
    };
  }

  // ==================== AUDIT LOG ====================

  appendAuditLog(entry: {
    userId: string;
    userName: string;
    action: "created" | "updated" | "deleted";
    entityType: AuditLog["entityType"];
    entityId: string;
    details?: string;
  }): AuditLog {
    const id = "audit-" + generateId();
    const createdAt = now();
    this.db
      .prepare("INSERT INTO audit_logs (id, user_id, user_name, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, entry.userId, entry.userName, entry.action, entry.entityType, entry.entityId, entry.details ?? null, createdAt);
    const count = (this.db.prepare("SELECT COUNT(*) as c FROM audit_logs").get() as { c: number }).c;
    if (count > 500) {
      const oldest = this.db.prepare("SELECT id FROM audit_logs ORDER BY created_at ASC LIMIT 1").get() as { id: string } | undefined;
      if (oldest) this.db.prepare("DELETE FROM audit_logs WHERE id = ?").run(oldest.id);
    }
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

  getAuditLogs(limit = 100): AuditLog[] {
    const rows = this.db.prepare("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?").all(limit) as AuditLogRow[];
    return rows.map(mapAuditLog);
  }

  // ==================== FAMILY DOCUMENTS ====================

  getDocumentsByFamily(familyId: string): FamilyDocument[] {
    const rows = this.db.prepare("SELECT * FROM family_documents WHERE family_id = ? ORDER BY uploaded_at DESC").all(familyId) as FamilyDocumentRow[];
    return rows.map(mapFamilyDocument);
  }

  createFamilyDocument(input: CreateFamilyDocumentInput & { uploadedBy: string; uploadedByName: string }): FamilyDocument {
    const id = "doc-" + generateId();
    const uploadedAt = now();
    this.db
      .prepare(
        "INSERT INTO family_documents (id, family_id, name, document_type, file_data, mime_type, uploaded_at, uploaded_by, uploaded_by_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(id, input.familyId, input.name, input.documentType, input.fileData, input.mimeType, uploadedAt, input.uploadedBy, input.uploadedByName);
    return mapFamilyDocument({
      id,
      family_id: input.familyId,
      name: input.name,
      document_type: input.documentType,
      file_data: input.fileData,
      mime_type: input.mimeType,
      uploaded_at: uploadedAt,
      uploaded_by: input.uploadedBy,
      uploaded_by_name: input.uploadedByName,
    });
  }

  deleteFamilyDocument(id: string): boolean {
    return this.db.prepare("DELETE FROM family_documents WHERE id = ?").run(id).changes > 0;
  }
}

export const storage = new Storage();
