import { RequestHandler } from "express";
import { CreateAidSchema } from "../../shared/schema";
import { storage } from "../storage";

export const handleGetAids: RequestHandler = (_req, res) => {
  res.json(storage.getAllAids());
};

export const handleGetAidsByFamily: RequestHandler = (req, res) => {
  res.json(storage.getAidsByFamily(req.params.familyId as string));
};

export const handleCreateAid: RequestHandler = (req, res) => {
  const parsed = CreateAidSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides", details: parsed.error.flatten() });
    return;
  }

  const user = (res as any).locals?.user;
  if (!user) {
    res.status(401).json({ error: "Authentification requise" });
    return;
  }

  const aid = storage.createAid({
    ...parsed.data,
    volunteerId: user.id,
    volunteerName: user.name,
  });

  if (user) {
    storage.appendAuditLog({
      userId: user.id,
      userName: user.name,
      action: "created",
      entityType: "aid",
      entityId: aid.id,
      details: `${aid.type} x${aid.quantity}`,
    });
  }
  res.status(201).json(aid);
};
