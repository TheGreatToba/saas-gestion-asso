import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

const bucket = process.env.OBJECT_STORAGE_BUCKET;
const region = process.env.OBJECT_STORAGE_REGION ?? "eu-west-1";
const endpoint = process.env.OBJECT_STORAGE_ENDPOINT;
const forcePathStyle = process.env.OBJECT_STORAGE_FORCE_PATH_STYLE === "true";

if (!bucket) {
  // En dev on log seulement; en prod ce sera une erreur lors de l'upload.
  console.warn(
    "[object-storage] OBJECT_STORAGE_BUCKET non défini. " +
      "Les uploads de documents échoueront tant que la configuration n'est pas complète.",
  );
}

const s3 = new S3Client({
  region,
  endpoint,
  forcePathStyle,
});

export interface UploadFamilyDocumentParams {
  familyId: string;
  documentId: string;
  mimeType: string;
  buffer: Buffer;
}

export async function uploadFamilyDocumentObject(
  params: UploadFamilyDocumentParams,
): Promise<{ key: string }> {
  if (!bucket) {
    throw new Error("OBJECT_STORAGE_BUCKET non configuré");
  }

  const key = `families/${params.familyId}/${params.documentId}/${randomUUID()}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: params.buffer,
      ContentType: params.mimeType,
    }),
  );

  return { key };
}

export async function generateSignedDownloadUrl(
  key: string,
  opts?: { expiresInSeconds?: number },
): Promise<string> {
  if (!bucket) {
    throw new Error("OBJECT_STORAGE_BUCKET non configuré");
  }

  const expiresInSeconds = opts?.expiresInSeconds ?? 300; // 5 minutes

  const command = new PutObjectCommand({
    // NOTE: pour un simple téléchargement GET, on utiliserait GetObjectCommand,
    // mais ici nous voulons juste une URL signée; adapter si nécessaire.
    // On choisit plutôt de générer une URL GET via GetObjectCommand :
  } as any);

  // Correction: utiliser réellement GetObjectCommand
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const getCommand = new (GetObjectCommand as any)({
    Bucket: bucket,
    Key: key,
  });

  return await getSignedUrl(s3, getCommand, { expiresIn: expiresInSeconds });
}

export async function deleteObjectByKey(key: string): Promise<void> {
  if (!bucket) {
    // Rien à faire si pas configuré; on ne bloque pas la suppression logique.
    console.warn(
      "[object-storage] OBJECT_STORAGE_BUCKET non défini lors de la suppression d'objet.",
    );
    return;
  }
  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );
}

/**
 * Hook d'antivirus : à brancher sur un service externe (ClamAV, ICAP, SaaS…).
 * Pour l'instant, ne fait rien et accepte toujours.
 */
export async function scanBufferForViruses(_buffer: Buffer): Promise<void> {
  if (process.env.ANTIVIRUS_SCAN_ENABLED === "true") {
    // TODO: Intégrer ici l'appel vers un service ClamAV / ICAP / HTTP.
  }
}

