import type { AuditLog, AuditAction } from "../../shared/schema";
import type Database from "better-sqlite3";

export type AuditLogRow = {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string | null;
  created_at: string;
};

export function mapAuditLogRow(r: AuditLogRow): AuditLog {
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

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

function now(): string {
  return new Date().toISOString();
}

export class AuditRepository {
  constructor(private getDb: () => Database.Database) {}

  private get db(): Database.Database {
    return this.getDb();
  }

  append(
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
    return mapAuditLogRow({
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

  getByOrganization(organizationId: string, limit = 100): AuditLog[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM audit_logs WHERE organization_id = ? ORDER BY created_at DESC LIMIT ?",
      )
      .all(organizationId, limit) as AuditLogRow[];
    return rows.map(mapAuditLogRow);
  }

  getByDateRange(
    organizationId: string,
    fromIso: string,
    toIso: string,
  ): AuditLog[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM audit_logs
         WHERE organization_id = ? AND created_at >= ? AND created_at <= ?
         ORDER BY created_at ASC`,
      )
      .all(organizationId, fromIso, toIso) as AuditLogRow[];
    return rows.map(mapAuditLogRow);
  }

  pruneOlderThan(organizationId: string, retentionDays: number): number {
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
}
