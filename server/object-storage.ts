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

const CLAMAV_HOST = process.env.CLAMAV_HOST ?? "localhost";
const CLAMAV_PORT = parseInt(process.env.CLAMAV_PORT ?? "3310", 10);
const CLAMAV_TIMEOUT_MS = 30_000;
const INSTREAM_CHUNK_SIZE = 2048;

/**
 * Scan buffer via ClamAV daemon (clamd) using INSTREAM protocol.
 * When ANTIVIRUS_SCAN_ENABLED is "true", connects to clamd and streams the buffer.
 * On FOUND or connection failure (in production), throws.
 */
export async function scanBufferForViruses(buffer: Buffer): Promise<void> {
  if (process.env.ANTIVIRUS_SCAN_ENABLED !== "true") {
    return;
  }

  const { connect } = await import("node:net");

  return new Promise((resolve, reject) => {
    const socket = connect(
      { host: CLAMAV_HOST, port: CLAMAV_PORT, timeout: CLAMAV_TIMEOUT_MS },
      () => {
        socket.write("zINSTREAM\0");
        let offset = 0;
        const writeNext = () => {
          const len = Math.min(INSTREAM_CHUNK_SIZE, buffer.length - offset);
          if (len <= 0) {
            const zero = Buffer.alloc(4);
            zero.writeUInt32BE(0, 0);
            socket.write(zero, () => socket.end());
            return;
          }
          const chunk = buffer.subarray(offset, offset + len);
          offset += len;
          const lenBuf = Buffer.alloc(4);
          lenBuf.writeUInt32BE(len, 0);
          const ok = socket.write(Buffer.concat([lenBuf, chunk]));
          if (ok) {
            setImmediate(writeNext);
          } else {
            socket.once("drain", () => setImmediate(writeNext));
          }
        };
        setImmediate(writeNext);
      },
    );

    let response = "";
    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => {
      response += chunk;
    });
    socket.on("end", () => {
      const line = response.split("\n")[0]?.trim() ?? "";
      if (line.endsWith("OK")) {
        resolve();
      } else if (line.includes("FOUND")) {
        reject(new Error("Fichier rejeté par l’antivirus (menace détectée)."));
      } else {
        reject(new Error("Antivirus : réponse inattendue ou erreur de scan."));
      }
    });
    socket.on("error", (err: Error) => {
      const msg =
        process.env.NODE_ENV === "production"
          ? "Scan antivirus indisponible. Upload refusé."
          : `Antivirus (clamd) indisponible: ${err.message}. En production l’upload serait refusé.`;
      reject(new Error(msg));
    });
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("Délai d’attente du scan antivirus dépassé."));
    });
  });
}

