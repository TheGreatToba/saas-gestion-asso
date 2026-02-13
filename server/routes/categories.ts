import { RequestHandler } from "express";
import { storage } from "../storage";

function getOrgId(res: any): string {
  return (res.locals?.user as { organizationId?: string } | undefined)?.organizationId ?? "org-default";
}

export const handleGetCategories: RequestHandler = (_req, res) => {
  const orgId = getOrgId(res);
  res.json(storage.getAllCategories(orgId));
};

export const handleCreateCategory: RequestHandler = (req, res) => {
  const orgId = getOrgId(res);
  const { name, description } = req.body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "Nom de catégorie requis" });
    return;
  }
  const category = storage.createCategory(orgId, {
    name: name.trim(),
    description: (description || "").trim(),
  });
  res.status(201).json(category);
};

export const handleUpdateCategory: RequestHandler = (req, res) => {
  const orgId = getOrgId(res);
  const id = String(req.params.id);
  const { name, description } = req.body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "Nom de catégorie requis" });
    return;
  }
  const updates: Record<string, unknown> = { name: name.trim() };
  if (description !== undefined) updates.description = description.trim();
  const category = storage.updateCategory(id, orgId, updates as any);
  if (!category) {
    res.status(404).json({ error: "Catégorie non trouvée" });
    return;
  }
  res.json(category);
};

export const handleDeleteCategory: RequestHandler = (req, res) => {
  const orgId = getOrgId(res);
  const id = String(req.params.id);
  const deleted = storage.deleteCategory(id, orgId);
  if (!deleted) {
    res.status(404).json({ error: "Catégorie non trouvée" });
    return;
  }
  res.json({ success: true });
};
