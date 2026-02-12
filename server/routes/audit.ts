import { RequestHandler } from "express";
import { storage } from "../storage";

function getOrgId(res: any): string {
  return (res.locals?.user as { organizationId?: string } | undefined)?.organizationId ?? "org-default";
}

export const handleGetAuditLogs: RequestHandler = (req, res) => {
  const orgId = getOrgId(res);
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 200);
  const logs = storage.getAuditLogs(orgId, limit);
  res.json(logs);
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
