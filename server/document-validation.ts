/**
 * Validate file content matches declared MIME type using magic bytes (file signatures).
 * Rejects uploads where the actual content type does not match the declared type.
 */

const SIGNATURES: { mime: string; patterns: { offset: number; bytes: number[] }[] }[] = [
  {
    mime: "application/pdf",
    patterns: [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }], // %PDF
  },
  {
    mime: "image/jpeg",
    patterns: [
      { offset: 0, bytes: [0xff, 0xd8, 0xff] },
    ],
  },
  {
    mime: "image/png",
    patterns: [
      {
        offset: 0,
        bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      },
    ],
  },
  {
    mime: "image/gif",
    patterns: [
      { offset: 0, bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] }, // GIF87a
      { offset: 0, bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] }, // GIF89a
    ],
  },
  {
    mime: "image/webp",
    patterns: [
      {
        offset: 0,
        bytes: [0x52, 0x49, 0x46, 0x46], // RIFF
      },
    ],
  },
];

function matchesSignature(buffer: Buffer, pattern: { offset: number; bytes: number[] }): boolean {
  if (buffer.length < pattern.offset + pattern.bytes.length) return false;
  for (let i = 0; i < pattern.bytes.length; i++) {
    if (buffer[pattern.offset + i] !== pattern.bytes[i]) return false;
  }
  return true;
}

/** For WebP we also check bytes 8–11 for "WEBP". */
function isWebP(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  const riff = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
  const webp =
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50;
  return riff && webp;
}

/**
 * Returns the MIME type inferred from magic bytes, or null if no signature matches.
 */
export function getMimeFromMagicBytes(buffer: Buffer): string | null {
  if (!buffer || buffer.length < 4) return null;
  for (const { mime, patterns } of SIGNATURES) {
    if (mime === "image/webp") {
      if (isWebP(buffer)) return mime;
      continue;
    }
    for (const pattern of patterns) {
      if (matchesSignature(buffer, pattern)) return mime;
    }
  }
  return null;
}

const ALLOWED_MIME_PREFIXES = ["image/", "application/pdf"];

/**
 * Validates that the buffer's magic bytes match the declared MIME type.
 * @throws Error if the declared MIME is not allowed or does not match the content.
 */
export function validateMagicBytes(buffer: Buffer, declaredMimeType: string): void {
  const allowed = ALLOWED_MIME_PREFIXES.some((p) => declaredMimeType.toLowerCase().startsWith(p));
  if (!allowed) {
    throw new Error("Type de fichier non autorisé");
  }
  const inferred = getMimeFromMagicBytes(buffer);
  if (inferred === null) {
    throw new Error(
      "Impossible de vérifier le type de fichier. Format non reconnu ou fichier corrompu.",
    );
  }
  const declaredNorm = declaredMimeType.toLowerCase().split(";")[0].trim();
  if (inferred !== declaredNorm) {
    throw new Error(
      `Le contenu du fichier ne correspond pas au type déclaré (attendu: ${declaredNorm}, détecté: ${inferred}).`,
    );
  }
}
