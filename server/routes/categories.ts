import { RequestHandler } from "express";
import { storage } from "../storage";

export const handleGetCategories: RequestHandler = (_req, res) => {
  res.json(storage.getAllCategories());
};

export const handleCreateCategory: RequestHandler = (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "Nom de catégorie requis" });
    return;
  }
  const category = storage.createCategory({ name: name.trim() });
  res.status(201).json(category);
};

export const handleUpdateCategory: RequestHandler = (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "Nom de catégorie requis" });
    return;
  }
  const category = storage.updateCategory(id, { name: name.trim() });
  if (!category) {
    res.status(404).json({ error: "Catégorie non trouvée" });
    return;
  }
  res.json(category);
};

export const handleDeleteCategory: RequestHandler = (req, res) => {
  const { id } = req.params;
  const deleted = storage.deleteCategory(id);
  if (!deleted) {
    res.status(404).json({ error: "Catégorie non trouvée" });
    return;
  }
  res.json({ success: true });
};
