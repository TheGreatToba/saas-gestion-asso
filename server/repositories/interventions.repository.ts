import type {
  Intervention,
  CreateInterventionInput,
  InterventionChecklistItem,
} from "../../shared/schema";
import type Database from "better-sqlite3";

export type InterventionRow = {
  id: string;
  organization_id: string;
  family_id: string;
  assigned_user_id: string;
  assigned_user_name: string;
  status: string;
  planned_at: string;
  started_at: string | null;
  completed_at: string | null;
  checklist_json: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

function parseChecklist(json: string): InterventionChecklistItem[] {
  try {
    const arr = JSON.parse(json || "[]");
    return Array.isArray(arr)
      ? arr.map((x: any) => ({
          id: String(x?.id ?? ""),
          label: String(x?.label ?? ""),
          done: Boolean(x?.done),
        }))
      : [];
  } catch {
    return [];
  }
}

export function mapInterventionRow(r: InterventionRow): Intervention {
  return {
    id: r.id,
    familyId: r.family_id,
    assignedUserId: r.assigned_user_id,
    assignedUserName: r.assigned_user_name,
    status: r.status as Intervention["status"],
    plannedAt: r.planned_at,
    startedAt: r.started_at ?? undefined,
    completedAt: r.completed_at ?? undefined,
    checklist: parseChecklist(r.checklist_json),
    notes: r.notes ?? "",
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

export class InterventionsRepository {
  constructor(private getDb: () => Database.Database) {}

  private get db(): Database.Database {
    return this.getDb();
  }

  getById(id: string): Intervention | null {
    const r = this.db
      .prepare("SELECT * FROM interventions WHERE id = ?")
      .get(id) as InterventionRow | undefined;
    return r ? mapInterventionRow(r) : null;
  }

  getByIdAndOrg(id: string, organizationId: string): Intervention | null {
    const r = this.db
      .prepare(
        "SELECT * FROM interventions WHERE id = ? AND organization_id = ?",
      )
      .get(id, organizationId) as InterventionRow | undefined;
    return r ? mapInterventionRow(r) : null;
  }

  getPage(
    organizationId: string,
    opts: {
      limit: number;
      offset: number;
      status?: string;
      assignedUserId?: string;
    },
  ): { items: Intervention[]; total: number } {
    const { limit, offset, status, assignedUserId } = opts;
    const org = organizationId || DEFAULT_ORG;
    const conditions: string[] = ["organization_id = ?"];
    const params: (string | number)[] = [org];
    if (status) {
      conditions.push("status = ?");
      params.push(status);
    }
    if (assignedUserId) {
      conditions.push("assigned_user_id = ?");
      params.push(assignedUserId);
    }
    const where = conditions.join(" AND ");
    const countRow = this.db
      .prepare(`SELECT COUNT(*) as c FROM interventions WHERE ${where}`)
      .get(...params) as { c: number };
    const rows = this.db
      .prepare(
        `SELECT * FROM interventions WHERE ${where} ORDER BY planned_at ASC, created_at DESC LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as InterventionRow[];
    return {
      total: countRow.c,
      items: rows.map(mapInterventionRow),
    };
  }

  /** Liste des interventions assignées à un utilisateur (pour "Mes interventions"). */
  getByAssignedUser(
    organizationId: string,
    userId: string,
    opts?: { status?: string },
  ): Intervention[] {
    const org = organizationId || DEFAULT_ORG;
    let sql =
      "SELECT * FROM interventions WHERE organization_id = ? AND assigned_user_id = ?";
    const params: (string | number)[] = [org, userId];
    if (opts?.status) {
      sql += " AND status = ?";
      params.push(opts.status);
    }
    sql += " ORDER BY planned_at ASC, created_at DESC";
    const rows = this.db.prepare(sql).all(...params) as InterventionRow[];
    return rows.map(mapInterventionRow);
  }

  create(
    organizationId: string,
    input: CreateInterventionInput,
    assignedUserName: string,
  ): Intervention {
    const id = "int-" + generateId();
    const createdAt = now();
    const org = organizationId || DEFAULT_ORG;
    const checklistJson = JSON.stringify(input.checklist ?? []);
    this.db
      .prepare(
        `INSERT INTO interventions (
          id, organization_id, family_id, assigned_user_id, assigned_user_name,
          status, planned_at, started_at, completed_at, checklist_json, notes,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'todo', ?, NULL, NULL, ?, ?, ?, ?)`,
      )
      .run(
        id,
        org,
        input.familyId,
        input.assignedUserId,
        assignedUserName,
        input.plannedAt,
        checklistJson,
        input.notes ?? "",
        createdAt,
        createdAt,
      );
    return mapInterventionRow({
      id,
      organization_id: org,
      family_id: input.familyId,
      assigned_user_id: input.assignedUserId,
      assigned_user_name: assignedUserName,
      status: "todo",
      planned_at: input.plannedAt,
      started_at: null,
      completed_at: null,
      checklist_json: checklistJson,
      notes: input.notes ?? "",
      created_at: createdAt,
      updated_at: createdAt,
    });
  }

  update(
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
    const existing = this.getByIdAndOrg(id, organizationId);
    if (!existing) return null;
    const updatedAt = now();
    const checklistJson =
      input.checklist !== undefined
        ? JSON.stringify(input.checklist)
        : undefined;
    this.db
      .prepare(
        `UPDATE interventions SET
          assigned_user_id = COALESCE(?, assigned_user_id),
          assigned_user_name = COALESCE(?, assigned_user_name),
          planned_at = COALESCE(?, planned_at),
          checklist_json = COALESCE(?, checklist_json),
          notes = COALESCE(?, notes),
          updated_at = ?
        WHERE id = ? AND organization_id = ?`,
      )
      .run(
        input.assignedUserId ?? null,
        input.assignedUserName ?? null,
        input.plannedAt ?? null,
        checklistJson ?? null,
        input.notes ?? null,
        updatedAt,
        id,
        organizationId,
      );
    return this.getByIdAndOrg(id, organizationId);
  }

  updateStatus(
    id: string,
    organizationId: string,
    status: "todo" | "in_progress" | "done",
  ): Intervention | null {
    const existing = this.getByIdAndOrg(id, organizationId);
    if (!existing) return null;
    const nowIso = now();
    let startedAt: string | null = existing.startedAt ?? null;
    let completedAt: string | null = existing.completedAt ?? null;
    if (status === "in_progress" && !startedAt) startedAt = nowIso;
    if (status === "done") {
      if (!startedAt) startedAt = nowIso;
      completedAt = nowIso;
    }
    this.db
      .prepare(
        `UPDATE interventions SET status = ?, started_at = ?, completed_at = ?, updated_at = ? WHERE id = ? AND organization_id = ?`,
      )
      .run(status, startedAt, completedAt, nowIso, id, organizationId);
    return this.getByIdAndOrg(id, organizationId);
  }

  updateChecklist(
    id: string,
    organizationId: string,
    checklist: InterventionChecklistItem[],
  ): Intervention | null {
    const existing = this.getByIdAndOrg(id, organizationId);
    if (!existing) return null;
    const updatedAt = now();
    this.db
      .prepare(
        "UPDATE interventions SET checklist_json = ?, updated_at = ? WHERE id = ? AND organization_id = ?",
      )
      .run(JSON.stringify(checklist), updatedAt, id, organizationId);
    return this.getByIdAndOrg(id, organizationId);
  }

  delete(id: string, organizationId: string): boolean {
    return (
      this.db
        .prepare("DELETE FROM interventions WHERE id = ? AND organization_id = ?")
        .run(id, organizationId).changes > 0
    );
  }
}
