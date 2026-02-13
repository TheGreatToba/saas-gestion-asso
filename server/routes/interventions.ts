import { RequestHandler } from "express";
import {
  CreateInterventionSchema,
  UpdateInterventionSchema,
  InterventionStatus,
} from "../../shared/schema";
import { storage } from "../storage";

const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 200;

function getOrgId(res: any): string {
  return (
    (res.locals?.user as { organizationId?: string } | undefined)
      ?.organizationId ?? "org-default"
  );
}

export const handleGetInterventions: RequestHandler = (req, res) => {
  const orgId = getOrgId(res);
  const limit = Math.min(
    Math.max(1, Number(req.query.limit) || DEFAULT_PAGE_LIMIT),
    MAX_PAGE_LIMIT,
  );
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const status = (req.query.status as string) || undefined;
  const assignedUserId = (req.query.assignedUserId as string) || undefined;
  const { items, total } = storage.getInterventionsPage(orgId, {
    limit,
    offset,
    status,
    assignedUserId,
  });
  res.json({ items, total });
};

export const handleGetMyInterventions: RequestHandler = (req, res) => {
  const orgId = getOrgId(res);
  const user = (res.locals?.user as { id: string } | undefined);
  if (!user) {
    res.status(401).json({ error: "Authentification requise" });
    return;
  }
  const status = (req.query.status as string) || undefined;
  const items = storage.getMyInterventions(orgId, user.id, { status });
  res.json(items);
};

export const handleGetIntervention: RequestHandler = (req, res) => {
  const orgId = getOrgId(res);
  const id = req.params.id as string;
  const intervention = storage.getIntervention(id, orgId);
  if (!intervention) {
    res.status(404).json({ error: "Intervention non trouvée" });
    return;
  }
  res.json(intervention);
};

export const handleCreateIntervention: RequestHandler = (req, res) => {
  const parsed = CreateInterventionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Données invalides",
      details: parsed.error.flatten(),
    });
    return;
  }
  const orgId = getOrgId(res);
  const intervention = storage.createIntervention(orgId, parsed.data);
  const user = (res as any).locals?.user;
  if (user) {
    storage.appendAuditLog(user.organizationId ?? "org-default", {
      userId: user.id,
      userName: user.name,
      action: "created",
      entityType: "intervention",
      entityId: intervention.id,
      details: intervention.familyId,
    });
  }
  res.status(201).json(intervention);
};

export const handleUpdateIntervention: RequestHandler = (req, res) => {
  const parsed = UpdateInterventionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Données invalides",
      details: parsed.error.flatten(),
    });
    return;
  }
  const orgId = getOrgId(res);
  const id = req.params.id as string;
  const user = (res as any).locals?.user;
  const existing = storage.getIntervention(id, orgId);
  if (!existing) {
    res.status(404).json({ error: "Intervention non trouvée" });
    return;
  }
  const assignedUserName =
    parsed.data.assignedUserId && user
      ? storage.getUser(parsed.data.assignedUserId)?.name
      : undefined;
  const updated = storage.updateIntervention(id, orgId, {
    assignedUserId: parsed.data.assignedUserId,
    assignedUserName: assignedUserName ?? existing.assignedUserName,
    plannedAt: parsed.data.plannedAt,
    checklist: parsed.data.checklist,
    notes: parsed.data.notes,
  });
  if (!updated) {
    res.status(404).json({ error: "Intervention non trouvée" });
    return;
  }
  if (user) {
    storage.appendAuditLog(user.organizationId ?? "org-default", {
      userId: user.id,
      userName: user.name,
      action: "updated",
      entityType: "intervention",
      entityId: id,
      details: undefined,
    });
  }
  res.json(updated);
};

export const handleUpdateInterventionStatus: RequestHandler = (req, res) => {
  const statusParsed = InterventionStatus.safeParse(req.body?.status);
  if (!statusParsed.success) {
    res.status(400).json({
      error: "Statut invalide",
      details: statusParsed.error.flatten(),
    });
    return;
  }
  const orgId = getOrgId(res);
  const id = req.params.id as string;
  const updated = storage.updateInterventionStatus(
    id,
    orgId,
    statusParsed.data,
  );
  if (!updated) {
    res.status(404).json({ error: "Intervention non trouvée" });
    return;
  }
  res.json(updated);
};

export const handleUpdateInterventionChecklist: RequestHandler = (req, res) => {
  const checklist = req.body?.checklist;
  if (!Array.isArray(checklist)) {
    res.status(400).json({ error: "checklist doit être un tableau" });
    return;
  }
  const orgId = getOrgId(res);
  const id = req.params.id as string;
  const items = checklist.map((x: any) => ({
    id: String(x?.id ?? ""),
    label: String(x?.label ?? ""),
    done: Boolean(x?.done),
  }));
  const updated = storage.updateInterventionChecklist(id, orgId, items);
  if (!updated) {
    res.status(404).json({ error: "Intervention non trouvée" });
    return;
  }
  res.json(updated);
};

export const handleDeleteIntervention: RequestHandler = (req, res) => {
  const orgId = getOrgId(res);
  const id = req.params.id as string;
  const deleted = storage.deleteIntervention(id, orgId);
  if (!deleted) {
    res.status(404).json({ error: "Intervention non trouvée" });
    return;
  }
  const user = (res as any).locals?.user;
  if (user) {
    storage.appendAuditLog(user.organizationId ?? "org-default", {
      userId: user.id,
      userName: user.name,
      action: "deleted",
      entityType: "intervention",
      entityId: id,
      details: undefined,
    });
  }
  res.json({ success: true });
};
