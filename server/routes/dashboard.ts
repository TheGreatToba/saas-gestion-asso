import { RequestHandler } from "express";
import { storage } from "../storage";

function getOrgId(res: any): string {
  return (res.locals?.user as { organizationId?: string } | undefined)?.organizationId ?? "org-default";
}

export const handleGetDashboardStats: RequestHandler = (_req, res) => {
  const orgId = getOrgId(res);
  res.json(storage.getDashboardStats(orgId));
};

export const handleGetExportData: RequestHandler = (req, res) => {
  const orgId = getOrgId(res);
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const offset = req.query.offset ? Number(req.query.offset) : undefined;

  if (
    (limit !== undefined && (Number.isNaN(limit) || limit <= 0)) ||
    (offset !== undefined && (Number.isNaN(offset) || offset < 0))
  ) {
    res.status(400).json({ error: "Paramètres de pagination invalides" });
    return;
  }

  const result = storage.getExportData(orgId, {
    limit: limit ?? 200,
    offset: offset ?? 0,
  });

  res.json(result);
};
