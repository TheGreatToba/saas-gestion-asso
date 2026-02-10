import { RequestHandler } from "express";
import { CreateFamilyDocumentSchema } from "../../shared/schema";
import { storage } from "../storage";

const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024; // ~5MB after base64
const ALLOWED_MIME_PREFIXES = ["image/", "application/pdf"];

function estimateBase64Size(base64: string): number {
  // Rough estimate: 4/3 bytes per base64 char
  return Math.floor((base64.length * 3) / 4);
}

export const handleGetFamilyDocuments: RequestHandler = (req, res) => {
  const docs = storage.getDocumentsByFamily(req.params.familyId as string);
  res.json(docs);
};

export const handleCreateFamilyDocument: RequestHandler = (req, res) => {
  const parsed = CreateFamilyDocumentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Données invalides",
      details: parsed.error.flatten(),
    });
    return;
  }

  const { fileData, mimeType } = parsed.data;

  // Basic MIME allow-list
  if (!ALLOWED_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix))) {
    res.status(400).json({
      error:
        "Type de fichier non autorisé. Seuls les PDF et les images sont acceptés.",
    });
    return;
  }

  // Basic size limit to avoid abusing JSON body limit
  const estimatedBytes = estimateBase64Size(fileData);
  if (estimatedBytes > MAX_DOCUMENT_BYTES) {
    res.status(400).json({
      error: "Fichier trop volumineux (limite ~5 Mo).",
    });
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
