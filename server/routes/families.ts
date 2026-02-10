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
  const user = (res as any).locals?.user;
  if (user) {
    storage.appendAuditLog({
      userId: user.id,
      userName: user.name,
      action: "created",
      entityType: "family",
      entityId: family.id,
      details: family.responsibleName,
    });
  }
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
  const user = (res as any).locals?.user;
  if (user) {
    storage.appendAuditLog({
      userId: user.id,
      userName: user.name,
      action: "updated",
      entityType: "family",
      entityId: family.id,
      details: family.responsibleName,
    });
  }
  res.json(family);
};

export const handleDeleteFamily: RequestHandler = (req, res) => {
  const id = req.params.id as string;
  const success = storage.deleteFamily(id);
  if (!success) {
    res.status(404).json({ error: "Famille non trouvée" });
    return;
  }
  const user = (res as any).locals?.user;
  if (user) {
    storage.appendAuditLog({
      userId: user.id,
      userName: user.name,
      action: "deleted",
      entityType: "family",
      entityId: id,
    });
  }
  res.json({ success: true });
};
