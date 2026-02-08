import { RequestHandler } from "express";
import { CreateFamilySchema } from "../../shared/schema";
import { storage } from "../storage";

export const handleGetFamilies: RequestHandler = (req, res) => {
  const search = req.query.search as string | undefined;
  if (search) {
    res.json(storage.searchFamilies(search));
  } else {
    res.json(storage.getAllFamilies());
  }
};

export const handleGetFamily: RequestHandler = (req, res) => {
  const family = storage.getFamily(req.params.id as string);
  if (!family) {
    res.status(404).json({ error: "Famille non trouvée" });
    return;
  }
  res.json(family);
};

export const handleCreateFamily: RequestHandler = (req, res) => {
  const parsed = CreateFamilySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides", details: parsed.error.flatten() });
    return;
  }
  const family = storage.createFamily(parsed.data);
  res.status(201).json(family);
};

export const handleUpdateFamily: RequestHandler = (req, res) => {
  const parsed = CreateFamilySchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides", details: parsed.error.flatten() });
    return;
  }
  const family = storage.updateFamily(req.params.id as string, parsed.data);
  if (!family) {
    res.status(404).json({ error: "Famille non trouvée" });
    return;
  }
  res.json(family);
};

export const handleDeleteFamily: RequestHandler = (req, res) => {
  const success = storage.deleteFamily(req.params.id as string);
  if (!success) {
    res.status(404).json({ error: "Famille non trouvée" });
    return;
  }
  res.json({ success: true });
};
