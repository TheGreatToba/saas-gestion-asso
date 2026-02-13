import type { FamilyDocument, CreateFamilyDocumentInput } from "../../shared/schema";
import type Database from "better-sqlite3";

export type FamilyDocumentRow = {
  id: string;
  family_id: string;
  name: string;
  document_type: string;
  file_data: string | null;
  mime_type: string;
  uploaded_at: string;
  uploaded_by: string;
  uploaded_by_name: string;
  file_key: string | null;
};

export function mapFamilyDocumentRow(r: FamilyDocumentRow): FamilyDocument {
  return {
    id: r.id,
    familyId: r.family_id,
    name: r.name,
    documentType: r.document_type as FamilyDocument["documentType"],
    fileKey: r.file_key ?? "",
    mimeType: r.mime_type,
    uploadedAt: r.uploaded_at,
    uploadedBy: r.uploaded_by,
    uploadedByName: r.uploaded_by_name,
    // URL signée ajoutée au niveau des routes (non stockée en base)
    downloadUrl: undefined,
  };
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

function now(): string {
  return new Date().toISOString();
}

export class DocumentsRepository {
  constructor(private getDb: () => Database.Database) {}

  private get db(): Database.Database {
    return this.getDb();
  }

  getByFamily(familyId: string): FamilyDocument[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM family_documents WHERE family_id = ? ORDER BY uploaded_at DESC",
      )
      .all(familyId) as FamilyDocumentRow[];
    return rows.map(mapFamilyDocumentRow);
  }

  getById(id: string): FamilyDocument | null {
    const row = this.db
      .prepare("SELECT * FROM family_documents WHERE id = ?")
      .get(id) as FamilyDocumentRow | undefined;
    return row ? mapFamilyDocumentRow(row) : null;
  }

  /**
   * Crée uniquement l'enregistrement de document en base, en supposant que
   * le fichier lui-même a déjà été envoyé dans le stockage objet.
   */
  create(input: {
    familyId: string;
    name: string;
    documentType: CreateFamilyDocumentInput["documentType"];
    mimeType: string;
    fileKey: string;
    uploadedBy: string;
    uploadedByName: string;
  }): FamilyDocument {
    // Idempotence best-effort : si un document identique vient d'être créé,
    // on le renvoie au lieu d'insérer un doublon.
    const tenSecondsAgo = new Date(Date.now() - 10_000).toISOString();
    const existing = this.db
      .prepare(
        `SELECT * FROM family_documents
         WHERE family_id = ?
           AND name = ?
           AND document_type = ?
           AND uploaded_by = ?
           AND uploaded_at >= ?
         ORDER BY uploaded_at DESC
         LIMIT 1`,
      )
      .get(
        input.familyId,
        input.name,
        input.documentType,
        input.uploadedBy,
        tenSecondsAgo,
      ) as FamilyDocumentRow | undefined;

    if (existing) {
      return mapFamilyDocumentRow(existing);
    }

    const id = "doc-" + generateId();
    const uploadedAt = now();
    this.db
      .prepare(
        "INSERT INTO family_documents (id, family_id, name, document_type, file_data, mime_type, uploaded_at, uploaded_by, uploaded_by_name, file_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        id,
        input.familyId,
        input.name,
        input.documentType,
        null, // stockage objet via file_key, plus de BLOB en base
        input.mimeType,
        uploadedAt,
        input.uploadedBy,
        input.uploadedByName,
        input.fileKey,
      );
    return mapFamilyDocumentRow({
      id,
      family_id: input.familyId,
      name: input.name,
      document_type: input.documentType,
      file_data: null,
      mime_type: input.mimeType,
      uploaded_at: uploadedAt,
      uploaded_by: input.uploadedBy,
      uploaded_by_name: input.uploadedByName,
      file_key: input.fileKey,
    });
  }

  delete(id: string): boolean {
    return (
      this.db.prepare("DELETE FROM family_documents WHERE id = ?").run(id)
        .changes > 0
    );
  }
}
