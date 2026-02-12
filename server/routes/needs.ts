import { RequestHandler } from "express";
import { CreateNeedSchema, UpdateNeedSchema, computeNeedPriority, getPriorityLevel } from "../../shared/schema";
import { storage } from "../storage";
import type { Need } from "../../shared/schema";

/** Enrich needs with computed priority score and level */
function enrichNeeds(needs: Need[], familyMap: Map<string, { lastVisitAt: string | null }>) {
  return needs.map((need) => {
    const family = familyMap.get(need.familyId);
    const score = computeNeedPriority(
      need.urgency,
      need.status,
      need.createdAt,
      family?.lastVisitAt ?? null,
    );
    return {
      ...need,
      priorityScore: score,
      priorityLevel: getPriorityLevel(score),
    };
  });
}

const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 200;

function getOrgId(res: any): string {
  return (res.locals?.user as { organizationId?: string } | undefined)?.organizationId ?? "org-default";
}

export const handleGetNeeds: RequestHandler = (req, res) => {
  const orgId = getOrgId(res);
  const limit = Math.min(
    Math.max(1, Number(req.query.limit) || DEFAULT_PAGE_LIMIT),
    MAX_PAGE_LIMIT,
  );
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const familyId = (req.query.familyId as string) || undefined;
  const { items: needs, total } = storage.getNeedsPage(orgId, { limit, offset, familyId });
  const familyIds = [...new Set(needs.map((n) => n.familyId))];
  const families = storage.getFamiliesByIds(orgId, familyIds);
  const familyMap = new Map(families.map((f) => [f.id, { lastVisitAt: f.lastVisitAt ?? null }]));
  const enriched = enrichNeeds(needs, familyMap);
  enriched.sort((a, b) => b.priorityScore - a.priorityScore);
  res.json({ items: enriched, total });
};

export const handleGetNeedsByFamily: RequestHandler = (req, res) => {
  const orgId = getOrgId(res);
  const familyId = req.params.familyId as string;
  if (!storage.getFamily(orgId, familyId)) {
    res.status(404).json({ error: "Famille non trouvée" });
    return;
  }
  const needs = storage.getNeedsByFamily(familyId);
  const families = storage.getFamiliesByIds(orgId, [familyId]);
  const familyMap = new Map(
    families.map((f) => [f.id, { lastVisitAt: f.lastVisitAt ?? null }]),
  );
  const enriched = enrichNeeds(needs, familyMap);
  enriched.sort((a, b) => b.priorityScore - a.priorityScore);
  res.json(enriched);
};

export const handleCreateNeed: RequestHandler = (req, res) => {
  const parsed = CreateNeedSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides", details: parsed.error.flatten() });
    return;
  }
  const need = storage.createNeed(parsed.data);
  const user = (res as any).locals?.user;
  if (user) {
    storage.appendAuditLog(user.organizationId ?? "org-default", {
      userId: user.id,
      userName: user.name,
      action: "created",
      entityType: "need",
      entityId: need.id,
      details: need.type,
    });
  }
  res.status(201).json(need);
};

export const handleUpdateNeed: RequestHandler = (req, res) => {
  const parsed = UpdateNeedSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides", details: parsed.error.flatten() });
    return;
  }
  const need = storage.updateNeed(req.params.id as string, parsed.data);
  if (!need) {
    res.status(404).json({ error: "Besoin non trouvé" });
    return;
  }
  const user = (res as any).locals?.user;
  if (user) {
    storage.appendAuditLog(user.organizationId ?? "org-default", {
      userId: user.id,
      userName: user.name,
      action: "updated",
      entityType: "need",
      entityId: need.id,
    });
  }
  res.json(need);
};

export const handleDeleteNeed: RequestHandler = (req, res) => {
  const id = req.params.id as string;
  const success = storage.deleteNeed(id);
  if (!success) {
    res.status(404).json({ error: "Besoin non trouvé" });
    return;
  }
  const user = (res as any).locals?.user;
  if (user) {
    storage.appendAuditLog(user.organizationId ?? "org-default", {
      userId: user.id,
      userName: user.name,
      action: "deleted",
      entityType: "need",
      entityId: id,
    });
  }
  res.json({ success: true });
};
