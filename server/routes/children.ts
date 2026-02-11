import { RequestHandler } from "express";
import { CreateChildSchema } from "../../shared/schema";
import { storage } from "../storage";

export const handleGetChildren: RequestHandler = (req, res) => {
  const familyId = req.params.familyId as string;
  res.json(storage.getChildrenByFamily(familyId));
};

export const handleCreateChild: RequestHandler = (req, res) => {
  const parsed = CreateChildSchema.safeParse({
    ...req.body,
    familyId: req.params.familyId as string,
  });
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides", details: parsed.error.flatten() });
    return;
  }
  const child = storage.createChild(parsed.data);
  res.status(201).json(child);
};

export const handleUpdateChild: RequestHandler = (req, res) => {
  const parsed = CreateChildSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Données invalides", details: parsed.error.flatten() });
    return;
  }
  const child = storage.updateChild(req.params.id as string, parsed.data);
  if (!child) {
    res.status(404).json({ error: "Enfant non trouvé" });
    return;
  }
  res.json(child);
};

export const handleDeleteChild: RequestHandler = (req, res) => {
  const success = storage.deleteChild(req.params.id as string);
  if (!success) {
    res.status(404).json({ error: "Enfant non trouvé" });
    return;
  }
  res.json({ success: true });
};
