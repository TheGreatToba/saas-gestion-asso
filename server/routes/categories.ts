import { RequestHandler } from "express";
import { storage } from "../storage";

export const handleGetCategories: RequestHandler = (_req, res) => {
  res.json(storage.getAllCategories());
};

export const handleCreateCategory: RequestHandler = (req, res) => {
  const { name, description } = req.body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "Nom de catégorie requis" });
    return;
  }
  const category = storage.createCategory({
    name: name.trim(),
    description: (description || "").trim(),
  });
  res.status(201).json(category);
};

export const handleUpdateCategory: RequestHandler = (req, res) => {
  const id = String(req.params.id);
  const { name, description } = req.body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "Nom de catégorie requis" });
    return;
  }
  const updates: Record<string, unknown> = { name: name.trim() };
  if (description !== undefined) updates.description = description.trim();
  const category = storage.updateCategory(id, updates as any);
  if (!category) {
    res.status(404).json({ error: "Catégorie non trouvée" });
    return;
  }
  res.json(category);
};

export const handleDeleteCategory: RequestHandler = (req, res) => {
  const id = String(req.params.id);
  const deleted = storage.deleteCategory(id);
  if (!deleted) {
    res.status(404).json({ error: "Catégorie non trouvée" });
    return;
  }
  res.json({ success: true });
};
