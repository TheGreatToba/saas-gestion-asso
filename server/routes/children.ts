import { RequestHandler } from "express";
import { CreateChildSchema } from "../../shared/schema";
import { storage } from "../storage";

function getOrgId(res: any): string {
  return (res.locals?.user as { organizationId?: string } | undefined)?.organizationId ?? "org-default";
}

export const handleGetChildren: RequestHandler = (req, res) => {
  const orgId = getOrgId(res);
  const familyId = req.params.familyId as string;
  if (!storage.getFamily(orgId, familyId)) {
    res.status(404).json({ error: "Famille non trouvée" });
    return;
  }
  res.json(storage.getChildrenByFamily(familyId));
};

export const handleCreateChild: RequestHandler = (req, res) => {
  const orgId = getOrgId(res);
  const familyId = req.params.familyId as string;
  if (!storage.getFamily(orgId, familyId)) {
    res.status(404).json({ error: "Famille non trouvée" });
    return;
  }
  const parsed = CreateChildSchema.safeParse({
    ...req.body,
    familyId,
  });
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides", details: parsed.error.flatten() });
    return;
  }
  const child = storage.createChild(parsed.data);
  res.status(201).json(child);
};

export const handleUpdateChild: RequestHandler = (req, res) => {
  const orgId = getOrgId(res);
  const childId = req.params.id as string;
  const existing = storage.getChild(childId);
  if (!existing || !storage.getFamily(orgId, existing.familyId)) {
    res.status(404).json({ error: "Enfant non trouvé" });
    return;
  }
  const parsed = CreateChildSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Données invalides", details: parsed.error.flatten() });
    return;
  }
  const child = storage.updateChild(childId, parsed.data);
  if (!child) {
    res.status(404).json({ error: "Enfant non trouvé" });
    return;
  }
  res.json(child);
};

export const handleDeleteChild: RequestHandler = (req, res) => {
  const orgId = getOrgId(res);
  const childId = req.params.id as string;
  const existing = storage.getChild(childId);
  if (!existing || !storage.getFamily(orgId, existing.familyId)) {
    res.status(404).json({ error: "Enfant non trouvé" });
    return;
  }
  const success = storage.deleteChild(childId);
  if (!success) {
    res.status(404).json({ error: "Enfant non trouvé" });
    return;
  }
  res.json({ success: true });
};
