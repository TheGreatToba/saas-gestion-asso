import { RequestHandler } from "express";
import { storage } from "../storage";

export const handleGetCategories: RequestHandler = (_req, res) => {
  res.json(storage.getAllCategories());
};

export const handleCreateCategory: RequestHandler = (req, res) => {
  const { name, description, unit, stockQuantity, stockMin } = req.body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "Nom de catégorie requis" });
    return;
  }
  const category = storage.createCategory({
    name: name.trim(),
    description: description?.trim() ?? "",
    unit: unit?.trim() ?? "unités",
    stockQuantity: typeof stockQuantity === "number" ? stockQuantity : 0,
    stockMin: typeof stockMin === "number" ? stockMin : 0,
  });
  res.status(201).json(category);
};

export const handleUpdateCategory: RequestHandler = (req, res) => {
  const id = String(req.params.id);
  const { name, description, unit, stockQuantity, stockMin } = req.body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "Nom de catégorie requis" });
    return;
  }
  const updates: Record<string, unknown> = { name: name.trim() };
  if (description !== undefined) updates.description = description.trim();
  if (unit !== undefined) updates.unit = unit.trim();
  if (typeof stockQuantity === "number") updates.stockQuantity = stockQuantity;
  if (typeof stockMin === "number") updates.stockMin = stockMin;

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

export const handleAdjustStock: RequestHandler = (req, res) => {
  const id = String(req.params.id);
  const { delta } = req.body;
  if (typeof delta !== "number") {
    res.status(400).json({ error: "delta (nombre) requis" });
    return;
  }
  const category = storage.adjustCategoryStock(id, delta);
  if (!category) {
    res.status(404).json({ error: "Catégorie non trouvée" });
    return;
  }
  res.json(category);
};
