import { RequestHandler } from "express";
import { CreateFamilySchema, type CreateFamilyInput } from "../../shared/schema";
import { storage } from "../storage";
import { getDb } from "../db";

type ImportFamilyRow = Partial<CreateFamilyInput> & {
  phone?: string | number | null;
  responsibleName?: string | null;
  address?: string | null;
  neighborhood?: string | null;
  memberCount?: string | number | null;
  childrenCount?: string | number | null;
  housing?: string | null;
  housingName?: string | null;
  healthNotes?: string | null;
  hasMedicalNeeds?: string | boolean | number | null;
  notes?: string | null;
};

type ImportPayload = {
  rows: ImportFamilyRow[];
  duplicateStrategy?: "skip" | "update";
};

const HOUSING_ALIASES: Record<string, CreateFamilyInput["housing"]> = {
  housed: "housed",
  "heberge": "housed",
  "hébergé": "housed",
  "heberge en foyer": "housed",
  "hébergé en foyer": "housed",
  "en foyer": "housed",
  "pending_placement": "pending_placement",
  "en attente": "pending_placement",
  "en attente de placement": "pending_placement",
  "not_housed": "not_housed",
  "sans hebergement": "not_housed",
  "sans hébergement": "not_housed",
  "sans domicile": "not_housed",
};

function normalizePhoneForCompare(input: string | undefined): string {
  return (input ?? "").replace(/\D/g, "");
}

function toStringValue(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const str = String(value).trim();
  return str.length ? str : undefined;
}

function toNumberValue(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const num = typeof value === "number" ? value : parseInt(String(value), 10);
  if (Number.isNaN(num)) return undefined;
  return num;
}

function toBooleanValue(value: unknown): boolean | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "boolean") return value;
  const str = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "oui"].includes(str)) return true;
  if (["0", "false", "no", "non"].includes(str)) return false;
  return undefined;
}

function normalizeHousing(value: unknown): CreateFamilyInput["housing"] | undefined {
  const raw = toStringValue(value);
  if (!raw) return undefined;
  const key = raw.toLowerCase().replace(/\s+/g, " ").trim();
  return HOUSING_ALIASES[key];
}

function normalizeRow(row: ImportFamilyRow): Partial<CreateFamilyInput> {
  return {
    responsibleName: toStringValue(row.responsibleName),
    phone: toStringValue(row.phone),
    address: toStringValue(row.address),
    neighborhood: toStringValue(row.neighborhood),
    memberCount: toNumberValue(row.memberCount),
    childrenCount: toNumberValue(row.childrenCount),
    housing: normalizeHousing(row.housing),
    housingName: toStringValue(row.housingName),
    healthNotes: toStringValue(row.healthNotes),
    hasMedicalNeeds: toBooleanValue(row.hasMedicalNeeds),
    notes: toStringValue(row.notes),
  };
}

export const handleImportFamilies: RequestHandler = (req, res) => {
  const payload = req.body as ImportPayload;
  if (!payload?.rows || !Array.isArray(payload.rows)) {
    res.status(400).json({ error: "Données invalides" });
    return;
  }

  const duplicateStrategy =
    payload.duplicateStrategy === "update" ? "update" : "skip";

  const db = getDb();
  const tx = db.transaction(() => {
    const existing = storage.getAllFamilies();
    const existingByPhone = new Map(
      existing
        .filter((f) => f.phone)
        .map((f) => [normalizePhoneForCompare(f.phone), f]),
    );

  const result = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [] as { row: number; message: string }[],
  };

  const actor = (res as any).locals?.user as { id: string; name: string } | undefined;

    payload.rows.forEach((raw, idx) => {
    const normalized = normalizeRow(raw);
    const phoneKey = normalizePhoneForCompare(normalized.phone);
    const existingFamily = phoneKey ? existingByPhone.get(phoneKey) : undefined;

    if (existingFamily) {
      if (duplicateStrategy === "skip") {
        result.skipped += 1;
        return;
      }

      const parsed = CreateFamilySchema.partial().safeParse(normalized);
      if (!parsed.success) {
        result.errors.push({
          row: idx + 1,
          message: "Données invalides pour mise à jour",
        });
        return;
      }

      const updated = storage.updateFamily(existingFamily.id, parsed.data);
      if (updated) {
        result.updated += 1;
        if (actor) {
          storage.appendAuditLog({
            userId: actor.id,
            userName: actor.name,
            action: "updated",
            entityType: "family",
            entityId: updated.id,
            details: `Import CSV: ${updated.responsibleName}`,
          });
        }
      }
      return;
    }

    const prepared: CreateFamilyInput = {
      responsibleName: normalized.responsibleName ?? "",
      phone: normalized.phone ?? "",
      address: normalized.address ?? "",
      neighborhood: normalized.neighborhood ?? "",
      memberCount: normalized.memberCount ?? 1,
      childrenCount: normalized.childrenCount ?? 0,
      housing: normalized.housing ?? "not_housed",
      housingName: normalized.housingName ?? "",
      healthNotes: normalized.healthNotes ?? "",
      hasMedicalNeeds: normalized.hasMedicalNeeds ?? false,
      notes: normalized.notes ?? "",
    };

    const parsed = CreateFamilySchema.safeParse(prepared);
    if (!parsed.success) {
      result.errors.push({
        row: idx + 1,
        message: "Données invalides ou incomplètes",
      });
      return;
    }

    const created = storage.createFamily(parsed.data);
    result.created += 1;
    if (phoneKey) {
      existingByPhone.set(phoneKey, created);
    }
    if (actor) {
      storage.appendAuditLog({
        userId: actor.id,
        userName: actor.name,
        action: "created",
        entityType: "family",
        entityId: created.id,
        details: `Import CSV: ${created.responsibleName}`,
      });
    }
    });
  });

  try {
    tx();
  } catch (err) {
    console.error("[import/families] Erreur transaction import", err);
    res.status(500).json({ error: "Erreur lors de l'import, aucune modification appliquée" });
    return;
  }

  res.json(result);
};
