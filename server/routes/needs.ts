import { RequestHandler } from "express";
import { CreateNeedSchema } from "../../shared/schema";
import { storage } from "../storage";

export const handleGetNeeds: RequestHandler = (_req, res) => {
  res.json(storage.getAllNeeds());
};

export const handleGetNeedsByFamily: RequestHandler = (req, res) => {
  res.json(storage.getNeedsByFamily(req.params.familyId as string));
};

export const handleCreateNeed: RequestHandler = (req, res) => {
  const parsed = CreateNeedSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides", details: parsed.error.flatten() });
    return;
  }
  const need = storage.createNeed(parsed.data);
  res.status(201).json(need);
};

export const handleUpdateNeed: RequestHandler = (req, res) => {
  const need = storage.updateNeed(req.params.id as string, req.body);
  if (!need) {
    res.status(404).json({ error: "Besoin non trouvé" });
    return;
  }
  res.json(need);
};

export const handleDeleteNeed: RequestHandler = (req, res) => {
  const success = storage.deleteNeed(req.params.id as string);
  if (!success) {
    res.status(404).json({ error: "Besoin non trouvé" });
    return;
  }
  res.json({ success: true });
};
