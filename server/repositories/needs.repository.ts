import type { Need, CreateNeedInput } from "../../shared/schema";
import type Database from "better-sqlite3";

export type NeedRow = {
  id: string;
  family_id: string;
  type: string;
  urgency: string;
  status: string;
  comment: string;
  details: string;
  created_at: string;
  updated_at: string;
  organization_id: string | null;
};

export function mapNeedRow(r: NeedRow): Need {
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

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

function now(): string {
  return new Date().toISOString();
}

const DEFAULT_ORG = "org-default";

export class NeedsRepository {
  constructor(private getDb: () => Database.Database) {}

  private get db(): Database.Database {
    return this.getDb();
  }

  getByFamily(familyId: string): Need[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM needs WHERE family_id = ? ORDER BY created_at DESC",
      )
      .all(familyId) as NeedRow[];
    return rows.map(mapNeedRow);
  }

  getByFamilyIds(familyIds: string[]): Map<string, Need[]> {
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
      list.push(mapNeedRow(r));
      map.set(r.family_id, list);
    }
    return map;
  }

  getPage(
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
    return { total: countRow.c, items: rows.map(mapNeedRow) };
  }

  create(organizationId: string, input: CreateNeedInput): Need {
    const id = "nd-" + generateId();
    const createdAt = now();
    const status = input.status ?? "pending";
    const org = organizationId || DEFAULT_ORG;
    this.db
      .prepare(
        "INSERT INTO needs (id, family_id, organization_id, type, urgency, status, comment, details, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        id,
        input.familyId,
        org,
        input.type,
        input.urgency,
        status,
        input.comment ?? "",
        input.details ?? "",
        createdAt,
        createdAt,
      );
    return mapNeedRow({
      id,
      family_id: input.familyId,
      type: input.type,
      urgency: input.urgency,
      status,
      comment: input.comment ?? "",
      details: input.details ?? "",
      created_at: createdAt,
      updated_at: createdAt,
      organization_id: org,
    });
  }

  update(
    id: string,
    organizationId: string,
    input: Partial<CreateNeedInput & { status: string }>,
  ): Need | null {
    const org = organizationId || DEFAULT_ORG;
    const r = this.db
      .prepare("SELECT * FROM needs WHERE id = ? AND organization_id = ?")
      .get(id, org) as NeedRow | undefined;
    if (!r) return null;
    const updatedAt = now();
    const type = input.type ?? r.type;
    const urgency = input.urgency ?? r.urgency;
    const status = input.status ?? r.status;
    const comment = input.comment !== undefined ? input.comment : r.comment;
    const details = input.details !== undefined ? input.details : r.details;
    this.db
      .prepare(
        "UPDATE needs SET type = ?, urgency = ?, status = ?, comment = ?, details = ?, updated_at = ? WHERE id = ? AND organization_id = ?",
      )
      .run(type, urgency, status, comment ?? "", details ?? "", updatedAt, id, org);
    return mapNeedRow({
      ...r,
      type,
      urgency,
      status,
      comment: comment ?? "",
      details: details ?? "",
      updated_at: updatedAt,
    });
  }

  delete(id: string, organizationId: string): boolean {
    const org = organizationId || DEFAULT_ORG;
    return this.db
      .prepare("DELETE FROM needs WHERE id = ? AND organization_id = ?")
      .run(id, org).changes > 0;
  }
}
