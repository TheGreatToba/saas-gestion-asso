import type { Family, CreateFamilyInput } from "../../shared/schema";
import type Database from "better-sqlite3";

export type FamilyRow = {
  id: string;
  number: number | null;
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
  archived: number;
};

export function mapFamilyRow(r: FamilyRow): Family {
  return {
    id: r.id,
    number: r.number ?? 0,
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

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

function now(): string {
  return new Date().toISOString();
}

export class FamiliesRepository {
  constructor(private getDb: () => Database.Database) {}

  private get db(): Database.Database {
    return this.getDb();
  }

  getById(organizationId: string, id: string): Family | null {
    const r = this.db
      .prepare(
        "SELECT * FROM families WHERE id = ? AND archived = 0 AND organization_id = ?",
      )
      .get(id, organizationId) as FamilyRow | undefined;
    return r ? mapFamilyRow(r) : null;
  }

  getPage(
    organizationId: string,
    opts: { limit: number; offset: number; search?: string },
  ): { items: Family[]; total: number } {
    const { limit, offset, search } = opts;
    const baseSql =
      "FROM families WHERE archived = 0 AND organization_id = ?";
    const orderBy =
      "ORDER BY (number IS NULL), number ASC, created_at ASC";
    if (search && search.trim()) {
      const q = "%" + search.trim().toLowerCase().replace(/%/g, "\\%") + "%";
      const countRow = this.db
        .prepare(
          `SELECT COUNT(*) as c ${baseSql} AND (lower(responsible_name) LIKE ? OR lower(neighborhood) LIKE ? OR lower(phone) LIKE ? OR lower(address) LIKE ?)`,
        )
        .get(organizationId, q, q, q, q) as { c: number };
      const rows = this.db
        .prepare(
          `SELECT * ${baseSql} AND (lower(responsible_name) LIKE ? OR lower(neighborhood) LIKE ? OR lower(phone) LIKE ? OR lower(address) LIKE ?) ${orderBy} LIMIT ? OFFSET ?`,
        )
        .all(organizationId, q, q, q, q, limit, offset) as FamilyRow[];
      return {
        total: countRow.c,
        items: rows.map(mapFamilyRow),
      };
    }
    const countRow = this.db
      .prepare(`SELECT COUNT(*) as c ${baseSql}`)
      .get(organizationId) as { c: number };
    const rows = this.db
      .prepare(`SELECT * ${baseSql} ${orderBy} LIMIT ? OFFSET ?`)
      .all(organizationId, limit, offset) as FamilyRow[];
    return { total: countRow.c, items: rows.map(mapFamilyRow) };
  }

  getByIds(organizationId: string, ids: string[]): Family[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => "?").join(",");
    const rows = this.db
      .prepare(
        `SELECT * FROM families WHERE archived = 0 AND organization_id = ? AND id IN (${placeholders})`,
      )
      .all(organizationId, ...ids) as FamilyRow[];
    return rows.map(mapFamilyRow);
  }

  getAll(organizationId: string): Family[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM families WHERE archived = 0 AND organization_id = ? ORDER BY (number IS NULL), number ASC, created_at ASC",
      )
      .all(organizationId) as FamilyRow[];
    return rows.map(mapFamilyRow);
  }

  search(organizationId: string, query: string, limit?: number): Family[] {
    const q = "%" + query.toLowerCase().replace(/%/g, "\\%") + "%";
    const base =
      "SELECT * FROM families WHERE archived = 0 AND organization_id = ? AND (lower(responsible_name) LIKE ? OR lower(neighborhood) LIKE ? OR lower(housing_name) LIKE ? OR lower(address) LIKE ? OR phone LIKE ?) ORDER BY (number IS NULL), number ASC";
    const sql = limit != null ? `${base} LIMIT ?` : base;
    const params = limit != null
      ? [organizationId, q, q, q, q, query, limit]
      : [organizationId, q, q, q, q, query];
    const rows = this.db.prepare(sql).all(...params) as FamilyRow[];
    return rows.map(mapFamilyRow);
  }

  create(organizationId: string, input: CreateFamilyInput): Family {
    if (input.phone && input.phone.trim() !== "") {
      const existing = this.db
        .prepare(
          "SELECT 1 FROM families WHERE organization_id = ? AND phone = ? AND archived = 0",
        )
        .get(organizationId, input.phone);
      if (existing) {
        throw new Error("Une famille avec ce téléphone existe déjà");
      }
    }

    const id = "fam-" + generateId();
    const row = this.db
      .prepare("SELECT MAX(number) as maxNumber FROM families WHERE organization_id = ?")
      .get(organizationId) as { maxNumber: number | null };
    const nextNumber = (row?.maxNumber ?? 0) + 1;
    const createdAt = now();
    const updatedAt = now();
    const memberCount = Math.max(1, input.memberCount ?? 1);
    const childrenCount = Math.max(0, input.childrenCount ?? 0);
    const housing = input.housing ?? "not_housed";

    try {
      this.db
        .prepare(
          `INSERT INTO families (id, organization_id, number, responsible_name, phone, address, neighborhood, member_count, children_count,
           housing, housing_name, health_notes, has_medical_needs, notes, created_at, updated_at, last_visit_at, archived)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        )
        .run(
          id,
          organizationId,
          nextNumber,
          input.responsibleName ?? "",
          input.phone ?? "",
          input.address ?? "",
          input.neighborhood ?? "",
          memberCount,
          childrenCount,
          housing,
          input.housingName ?? "",
          input.healthNotes ?? "",
          input.hasMedicalNeeds ? 1 : 0,
          input.notes ?? "",
          createdAt,
          updatedAt,
          null,
        );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes("member_count") && memberCount === 0) {
        this.db
          .prepare(
            `INSERT INTO families (id, organization_id, number, responsible_name, phone, address, neighborhood, member_count, children_count,
             housing, housing_name, health_notes, has_medical_needs, notes, created_at, updated_at, last_visit_at, archived)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
          )
          .run(
            id,
            organizationId,
            nextNumber,
            input.responsibleName ?? "",
            input.phone ?? "",
            input.address ?? "",
            input.neighborhood ?? "",
            1,
            childrenCount,
            housing,
            input.housingName ?? "",
            input.healthNotes ?? "",
            input.hasMedicalNeeds ? 1 : 0,
            input.notes ?? "",
            createdAt,
            updatedAt,
            null,
          );
      } else {
        throw err;
      }
    }
    return this.getById(organizationId, id)!;
  }

  update(
    organizationId: string,
    id: string,
    input: Partial<CreateFamilyInput>,
  ): Family | null {
    const r = this.db
      .prepare(
        "SELECT * FROM families WHERE id = ? AND archived = 0 AND organization_id = ?",
      )
      .get(id, organizationId) as FamilyRow | undefined;
    if (!r) return null;

    if (input.phone && input.phone !== r.phone) {
      const conflict = this.db
        .prepare(
          "SELECT 1 FROM families WHERE organization_id = ? AND phone = ? AND archived = 0 AND id != ?",
        )
        .get(organizationId, input.phone, id);
      if (conflict) {
        throw new Error("Une autre famille utilise déjà ce téléphone");
      }
    }
    const updatedAt = now();
    this.db
      .prepare(
        `UPDATE families SET responsible_name = ?, phone = ?, address = ?, neighborhood = ?, member_count = ?, children_count = ?,
         housing = ?, housing_name = ?, health_notes = ?, has_medical_needs = ?, notes = ?, updated_at = ?
         WHERE id = ? AND organization_id = ?`,
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
        input.hasMedicalNeeds !== undefined
          ? input.hasMedicalNeeds
            ? 1
            : 0
          : r.has_medical_needs,
        input.notes !== undefined ? input.notes : r.notes,
        updatedAt,
        id,
        organizationId,
      );
    return this.getById(organizationId, id);
  }

  delete(organizationId: string, id: string): boolean {
    const updatedAt = now();
    const info = this.db
      .prepare(
        "UPDATE families SET archived = 1, updated_at = ? WHERE id = ? AND archived = 0 AND organization_id = ?",
      )
      .run(updatedAt, id, organizationId);
    return info.changes > 0;
  }

  purgeArchived(organizationId: string): number {
    const info = this.db
      .prepare("DELETE FROM families WHERE archived = 1 AND organization_id = ?")
      .run(organizationId);
    return info.changes ?? 0;
  }

  resetAll(organizationId: string): number {
    const info = this.db
      .prepare("DELETE FROM families WHERE organization_id = ?")
      .run(organizationId);
    return info.changes ?? 0;
  }
}
