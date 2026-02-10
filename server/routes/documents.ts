import { RequestHandler } from "express";
import { CreateFamilyDocumentSchema } from "../../shared/schema";
import { storage } from "../storage";

export const handleGetFamilyDocuments: RequestHandler = (req, res) => {
  const docs = storage.getDocumentsByFamily(req.params.familyId as string);
  res.json(docs);
};

export const handleCreateFamilyDocument: RequestHandler = (req, res) => {
  const parsed = CreateFamilyDocumentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides", details: parsed.error.flatten() });
    return;
  }
  const user = (res as any).locals?.user;
  if (!user) {
    res.status(401).json({ error: "Authentification requise" });
    return;
  }
  const doc = storage.createFamilyDocument({
    ...parsed.data,
    uploadedBy: user.id,
    uploadedByName: user.name,
  });
  res.status(201).json(doc);
};

export const handleDeleteFamilyDocument: RequestHandler = (req, res) => {
  const success = storage.deleteFamilyDocument(req.params.documentId as string);
  if (!success) {
    res.status(404).json({ error: "Document non trouvé" });
    return;
  }
  res.json({ success: true });
};
