import { RequestHandler } from "express";
import { CreateAidSchema } from "../../shared/schema";
import { storage } from "../storage";

const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 200;

function getOrgId(res: any): string {
  return (res.locals?.user as { organizationId?: string } | undefined)?.organizationId ?? "org-default";
}

export const handleGetAids: RequestHandler = (req, res) => {
  const orgId = getOrgId(res);
  const limit = Math.min(
    Math.max(1, Number(req.query.limit) || DEFAULT_PAGE_LIMIT),
    MAX_PAGE_LIMIT,
  );
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const familyId = (req.query.familyId as string) || undefined;
  const result = storage.getAidsPage(orgId, { limit, offset, familyId });
  res.json(result);
};

export const handleGetAidsByFamily: RequestHandler = (req, res) => {
  const orgId = getOrgId(res);
  const familyId = req.params.familyId as string;
  if (!storage.getFamily(orgId, familyId)) {
    res.status(404).json({ error: "Famille non trouvée" });
    return;
  }
  res.json(storage.getAidsByFamily(familyId));
};

export const handleCreateAid: RequestHandler = (req, res) => {
  const parsed = CreateAidSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Données invalides", details: parsed.error.flatten() });
    return;
  }

  const user = (res as any).locals?.user;
  if (!user) {
    res.status(401).json({ error: "Authentification requise" });
    return;
  }

  const orgId = user.organizationId ?? "org-default";
  const aid = storage.createAid(orgId, {
    ...parsed.data,
    volunteerId: user.id,
    volunteerName: user.name,
  });

  if (user) {
    storage.appendAuditLog(user.organizationId ?? "org-default", {
      userId: user.id,
      userName: user.name,
      action: "created",
      entityType: "aid",
      entityId: aid.id,
      details: `${aid.type} x${aid.quantity}`,
    });
  }
  res.status(201).json(aid);
};

export const handleDeleteAid: RequestHandler = (req, res) => {
  const orgId = getOrgId(res);
  const id = req.params.id as string;
  const success = storage.deleteAid(id, orgId);
  if (!success) {
    res.status(404).json({ error: "Aide non trouvée" });
    return;
  }
  const user = (res as any).locals?.user;
  if (user) {
    storage.appendAuditLog(user.organizationId ?? "org-default", {
      userId: user.id,
      userName: user.name,
      action: "deleted",
      entityType: "aid",
      entityId: id,
    });
  }
  res.json({ success: true });
};
