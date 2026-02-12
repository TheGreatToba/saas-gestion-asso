import { RequestHandler } from "express";
import { CreateFamilyDocumentSchema } from "../../shared/schema";
import { storage } from "../storage";
import {
  deleteObjectByKey,
  generateSignedDownloadUrl,
  scanBufferForViruses,
  uploadFamilyDocumentObject,
} from "../object-storage";
import { validateMagicBytes } from "../document-validation";

const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024; // ~5Mo
const ALLOWED_MIME_PREFIXES = ["image/", "application/pdf"];

function extractBase64Payload(data: string): { mimeTypeFromDataUrl?: string; base64: string } {
  // data:[<mediatype>][;base64],<data>
  const match = data.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    return { mimeTypeFromDataUrl: match[1], base64: match[2] };
  }
  return { base64: data };
}

function estimateBase64Size(base64: string): number {
  // Approx: 4/3 bytes per base64 char
  return Math.floor((base64.length * 3) / 4);
}

export const handleGetFamilyDocuments: RequestHandler = async (req, res) => {
  const docs = storage.getDocumentsByFamily(req.params.familyId as string);

  const docsWithUrls = await Promise.all(
    docs.map(async (doc) => {
      if (!doc.fileKey) return doc;
      try {
        const url = await generateSignedDownloadUrl(doc.fileKey, {
          expiresInSeconds: 5 * 60,
        });
        return { ...doc, downloadUrl: url };
      } catch (err) {
        console.error("[documents] Erreur génération URL signée", err);
        return doc;
      }
    }),
  );

  res.json(docsWithUrls);
};

export const handleCreateFamilyDocument: RequestHandler = async (req, res) => {
  const parsed = CreateFamilyDocumentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Données invalides",
      details: parsed.error.flatten(),
    });
    return;
  }

  const { fileData, mimeType, familyId, name, documentType } = parsed.data;

  // Autorisation MIME basique
  if (!ALLOWED_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix))) {
    res.status(400).json({
      error:
        "Type de fichier non autorisé. Seuls les PDF et les images sont acceptés.",
    });
    return;
  }

  const { base64 } = extractBase64Payload(fileData);

  // Limite stricte de taille côté serveur
  const estimatedBytes = estimateBase64Size(base64);
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

  try {
    const buffer = Buffer.from(base64, "base64");

    try {
      validateMagicBytes(buffer, mimeType);
    } catch (validationErr) {
      const msg = validationErr instanceof Error ? validationErr.message : "Type de fichier invalide";
      res.status(400).json({ error: msg });
      return;
    }

    await scanBufferForViruses(buffer);

    // Upload dans le stockage objet
    const upload = await uploadFamilyDocumentObject({
      familyId,
      documentId: "pending", // clé de document logique utilisée uniquement pour le chemin
      mimeType,
      buffer,
    });

    let doc;
    try {
      // Crée l'enregistrement logique (avec fileKey)
      doc = storage.createFamilyDocumentRecord({
        familyId,
        name,
        documentType,
        mimeType,
        fileKey: upload.key,
        uploadedBy: user.id,
        uploadedByName: user.name,
      });
    } catch (dbErr) {
      // Si l'insertion DB échoue, on tente de nettoyer l'objet pour éviter les orphelins
      try {
        await deleteObjectByKey(upload.key);
      } catch (cleanupErr) {
        console.error("[documents] Échec nettoyage objet orphelin après erreur DB", cleanupErr);
      }
      throw dbErr;
    }

    // Générer immédiatement une URL signée pour le retour API
    let downloadUrl: string | undefined;
    if (doc.fileKey) {
      try {
        downloadUrl = await generateSignedDownloadUrl(doc.fileKey, {
          expiresInSeconds: 5 * 60,
        });
      } catch (err) {
        console.error("[documents] Erreur génération URL signée après création", err);
      }
    }

    res.status(201).json({ ...doc, downloadUrl });
  } catch (err) {
    console.error("[documents] Erreur lors de l'upload de document", err);
    res.status(500).json({ error: "Erreur lors de l'upload du document" });
  }
};

export const handleGetFamilyDocumentDownloadUrl: RequestHandler = async (req, res) => {
  const { familyId, documentId } = req.params as { familyId: string; documentId: string };
  const doc = storage.getFamilyDocument(documentId);
  if (!doc || doc.familyId !== familyId) {
    res.status(404).json({ error: "Document non trouvé" });
    return;
  }
  if (!doc.fileKey) {
    res.status(400).json({ error: "Document sans clé de fichier (ancien format)" });
    return;
  }
  try {
    const expiresInSeconds = 5 * 60;
    const url = await generateSignedDownloadUrl(doc.fileKey, { expiresInSeconds });
    res.json({ url, expiresInSeconds });
  } catch (err) {
    console.error("[documents] Erreur génération URL signée (endpoint dédié)", err);
    res.status(500).json({ error: "Impossible de générer le lien de téléchargement" });
  }
};

export const handleDeleteFamilyDocument: RequestHandler = async (req, res) => {
  const doc = storage.getFamilyDocument(req.params.documentId as string);
  const success = storage.deleteFamilyDocument(req.params.documentId as string);
  if (!success) {
    res.status(404).json({ error: "Document non trouvé" });
    return;
  }

  // Suppression "best effort" de l'objet dans le stockage
  if (doc?.fileKey) {
    try {
      await deleteObjectByKey(doc.fileKey);
    } catch (err) {
      console.error("[documents] Échec suppression objet stockage", err);
    }
  }

  res.json({ success: true });
};
