import { RequestHandler } from "express";
import { storage } from "../storage";
import type { AuditLog } from "../../shared/schema";

function getOrgId(res: any): string {
  return (res.locals?.user as { organizationId?: string } | undefined)?.organizationId ?? "org-default";
}

export const handleGetAuditLogs: RequestHandler = (req, res) => {
  const orgId = getOrgId(res);
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 200);
  const logs = storage.getAuditLogs(orgId, limit);
  res.json(logs);
};

const AUDIT_CSV_HEADERS = "date,userId,userName,action,entityType,entityId,details\n";

function escapeCsvCell(value: string): string {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Admin-only: export audit logs by date range as CSV or JSON. */
export const handleExportAuditLogs: RequestHandler = (req, res) => {
  const orgId = getOrgId(res);
  const from = (req.query.from as string)?.trim();
  const to = (req.query.to as string)?.trim();
  const format = ((req.query.format as string) ?? "json").toLowerCase();

  if (!from || !to) {
    res.status(400).json({
      error: "Paramètres from et to requis (ISO 8601, ex. 2025-01-01T00:00:00.000Z)",
    });
    return;
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    res.status(400).json({ error: "Dates from ou to invalides" });
    return;
  }
  if (fromDate > toDate) {
    res.status(400).json({ error: "La date from doit être antérieure à to" });
    return;
  }

  const logs = storage.getAuditLogsByDateRange(
    orgId,
    fromDate.toISOString(),
    toDate.toISOString(),
  );

  if (format === "csv") {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="audit-${from.slice(0, 10)}-${to.slice(0, 10)}.csv"`,
    );
    const rows = logs.map(
      (log: AuditLog) =>
        [
          log.createdAt,
          log.userId,
          log.userName,
          log.action,
          log.entityType,
          log.entityId,
          log.details ?? "",
        ].map(escapeCsvCell).join(","),
    );
    res.send(AUDIT_CSV_HEADERS + rows.join("\n"));
    return;
  }

  res.json({ from, to, count: logs.length, logs });
};

const DEFAULT_RETENTION_DAYS = 365;
const MAX_RETENTION_DAYS = 365 * 10;

/** Admin-only: prune audit log entries older than retention days (for cron/job). */
export const handlePruneAuditLogs: RequestHandler = (req, res) => {
  const orgId = getOrgId(res);
  const raw =
    (req.query.retentionDays as string) ??
    (req.body && typeof req.body === "object" && "retentionDays" in req.body
      ? String((req.body as { retentionDays?: number }).retentionDays)
      : undefined);
  const retentionDays = Math.min(
    Math.max(1, parseInt(raw ?? String(DEFAULT_RETENTION_DAYS), 10)),
    MAX_RETENTION_DAYS,
  );
  const deleted = storage.pruneAuditLogsOlderThan(orgId, retentionDays);
  res.json({ deleted, retentionDays });
};
