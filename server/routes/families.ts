import { RequestHandler } from "express";
import { CreateFamilySchema } from "../../shared/schema";
import { storage } from "../storage";

const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 200;

function getOrgId(res: any): string {
  return (res.locals?.user as { organizationId?: string } | undefined)?.organizationId ?? "org-default";
}

export const handleGetFamilies: RequestHandler = (req, res) => {
  const orgId = getOrgId(res);
  const limit = Math.min(
    Math.max(1, Number(req.query.limit) || DEFAULT_PAGE_LIMIT),
    MAX_PAGE_LIMIT,
  );
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const search = (req.query.search as string)?.trim();
  const result = storage.getFamiliesPage(orgId, { limit, offset, search });
  res.json(result);
};

export const handleGetFamily: RequestHandler = (req, res) => {
  const orgId = getOrgId(res);
  const family = storage.getFamily(orgId, req.params.id as string);
  if (!family) {
    res.status(404).json({ error: "Famille non trouvée" });
    return;
  }
  res.json(family);
};

export const handleCreateFamily: RequestHandler = (req, res) => {
  const parsed = CreateFamilySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides", details: parsed.error.flatten() });
    return;
  }
  const orgId = getOrgId(res);
  const family = storage.createFamily(orgId, parsed.data);
  const user = (res as any).locals?.user;
  if (user) {
    storage.appendAuditLog(user.organizationId ?? orgId, {
      userId: user.id,
      userName: user.name,
      action: "created",
      entityType: "family",
      entityId: family.id,
      details: family.responsibleName,
    });
  }
  res.status(201).json(family);
};

export const handleUpdateFamily: RequestHandler = (req, res) => {
  const parsed = CreateFamilySchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides", details: parsed.error.flatten() });
    return;
  }
  const orgId = getOrgId(res);
  const family = storage.updateFamily(orgId, req.params.id as string, parsed.data);
  if (!family) {
    res.status(404).json({ error: "Famille non trouvée" });
    return;
  }
  const user = (res as any).locals?.user;
  if (user) {
    storage.appendAuditLog(user.organizationId ?? orgId, {
      userId: user.id,
      userName: user.name,
      action: "updated",
      entityType: "family",
      entityId: family.id,
      details: family.responsibleName,
    });
  }
  res.json(family);
};

export const handleDeleteFamily: RequestHandler = (req, res) => {
  const orgId = getOrgId(res);
  const id = req.params.id as string;
  const success = storage.deleteFamily(orgId, id);
  if (!success) {
    res.status(404).json({ error: "Famille non trouvée" });
    return;
  }
  const user = (res as any).locals?.user;
  if (user) {
    storage.appendAuditLog(user.organizationId ?? orgId, {
      userId: user.id,
      userName: user.name,
      action: "deleted",
      entityType: "family",
      entityId: id,
    });
  }
  res.json({ success: true });
};

export const handlePurgeArchivedFamilies: RequestHandler = (_req, res) => {
  const orgId = getOrgId(res);
  const purged = storage.purgeArchivedFamilies(orgId);
  res.json({ purged });
};

export const handleResetAllFamilies: RequestHandler = (_req, res) => {
  const orgId = getOrgId(res);
  const purged = storage.resetAllFamilies(orgId);
  res.json({ purged });
};
