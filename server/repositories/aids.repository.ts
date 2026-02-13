import type { Aid, CreateAidStorageInput } from "../../shared/schema";
import type { NeedRow } from "./needs.repository";
import type Database from "better-sqlite3";

export type AidRow = {
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

export function mapAidRow(r: AidRow): Aid {
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

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

function now(): string {
  return new Date().toISOString();
}

const DEFAULT_ORG = "org-default";

export class AidsRepository {
  constructor(private getDb: () => Database.Database) {}

  private get db(): Database.Database {
    return this.getDb();
  }

  getByFamily(familyId: string): Aid[] {
    const rows = this.db
      .prepare("SELECT * FROM aids WHERE family_id = ? ORDER BY date DESC")
      .all(familyId) as AidRow[];
    return rows.map(mapAidRow);
  }

  getByFamilyIds(familyIds: string[]): Map<string, Aid[]> {
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
      list.push(mapAidRow(r));
      map.set(r.family_id, list);
    }
    return map;
  }

  getPage(
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
    return { total: countRow.c, items: rows.map(mapAidRow) };
  }

  create(organizationId: string, input: CreateAidStorageInput): Aid {
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
        return mapAidRow(recentDuplicate);
      }
    }

    const id = "aid-" + generateId();
    const createdAt = now();
    const date = input.date || now();
    const org = organizationId || DEFAULT_ORG;

    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          "INSERT INTO aids (id, family_id, organization_id, type, article_id, quantity, date, volunteer_id, volunteer_name, source, notes, proof_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          id,
          input.familyId,
          org,
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
    return mapAidRow(row);
  }

  delete(id: string, organizationId: string): boolean {
    return this.db
      .prepare("DELETE FROM aids WHERE id = ? AND organization_id = ?")
      .run(id, organizationId || DEFAULT_ORG).changes > 0;
  }
}
