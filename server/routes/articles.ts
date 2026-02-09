import { RequestHandler } from "express";
import { storage } from "../storage";

export const handleGetAllArticles: RequestHandler = (_req, res) => {
  res.json(storage.getAllArticles());
};

export const handleGetArticlesByCategory: RequestHandler = (req, res) => {
  const categoryId = String(req.params.categoryId);
  res.json(storage.getArticlesByCategory(categoryId));
};

export const handleCreateArticle: RequestHandler = (req, res) => {
  const { categoryId, name, description, unit, stockQuantity, stockMin } = req.body;
  if (!categoryId || !name || typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "categoryId et nom requis" });
    return;
  }
  if (!storage.getCategory(categoryId)) {
    res.status(404).json({ error: "Catégorie non trouvée" });
    return;
  }
  const article = storage.createArticle({
    categoryId,
    name: name.trim(),
    description: (description || "").trim(),
    unit: (unit || "unités").trim(),
    stockQuantity: typeof stockQuantity === "number" ? stockQuantity : 0,
    stockMin: typeof stockMin === "number" ? stockMin : 0,
  });
  res.status(201).json(article);
};

export const handleUpdateArticle: RequestHandler = (req, res) => {
  const id = String(req.params.id);
  const { name, description, unit, stockQuantity, stockMin } = req.body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "Nom requis" });
    return;
  }
  const updates: Record<string, unknown> = { name: name.trim() };
  if (description !== undefined) updates.description = description.trim();
  if (unit !== undefined) updates.unit = unit.trim();
  if (typeof stockQuantity === "number") updates.stockQuantity = stockQuantity;
  if (typeof stockMin === "number") updates.stockMin = stockMin;

  const article = storage.updateArticle(id, updates as any);
  if (!article) {
    res.status(404).json({ error: "Article non trouvé" });
    return;
  }
  res.json(article);
};

export const handleDeleteArticle: RequestHandler = (req, res) => {
  const id = String(req.params.id);
  const deleted = storage.deleteArticle(id);
  if (!deleted) {
    res.status(404).json({ error: "Article non trouvé" });
    return;
  }
  res.json({ success: true });
};

export const handleAdjustArticleStock: RequestHandler = (req, res) => {
  const id = String(req.params.id);
  const { delta } = req.body;
  if (typeof delta !== "number") {
    res.status(400).json({ error: "delta (nombre) requis" });
    return;
  }
  const article = storage.adjustArticleStock(id, delta);
  if (!article) {
    res.status(404).json({ error: "Article non trouvé" });
    return;
  }
  res.json(article);
};
