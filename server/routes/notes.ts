import { RequestHandler } from "express";
import { CreateVisitNoteSchema } from "../../shared/schema";
import { storage } from "../storage";

function getOrgId(res: any): string {
  return (res.locals?.user as { organizationId?: string } | undefined)?.organizationId ?? "org-default";
}

export const handleGetNotes: RequestHandler = (req, res) => {
  const orgId = getOrgId(res);
  const familyId = req.params.familyId as string;
  if (!storage.getFamily(orgId, familyId)) {
    res.status(404).json({ error: "Famille non trouvée" });
    return;
  }
  const notes = storage.getNotesByFamily(familyId);
  const user = (res as any).locals?.user;
  if (user) {
    storage.appendAuditLog(user.organizationId ?? "org-default", {
      userId: user.id,
      userName: user.name,
      action: "updated",
      entityType: "note",
      entityId: req.params.familyId as string,
      details: "Liste des notes consultée",
    });
  }
  res.json(notes);
};

export const handleCreateNote: RequestHandler = (req, res) => {
  const orgId = getOrgId(res);
  const familyId = req.params.familyId as string;
  if (!storage.getFamily(orgId, familyId)) {
    res.status(404).json({ error: "Famille non trouvée" });
    return;
  }
  const parsed = CreateVisitNoteSchema.safeParse({
    ...req.body,
    familyId,
  });
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Données invalides", details: parsed.error.flatten() });
    return;
  }

  const user = (res as any).locals?.user;
  if (!user) {
    res.status(401).json({ error: "Authentification requise" });
    return;
  }

  const note = storage.createVisitNote({
    ...parsed.data,
    volunteerId: user.id,
    volunteerName: user.name,
  });
  if (user) {
    storage.appendAuditLog(user.organizationId ?? "org-default", {
      userId: user.id,
      userName: user.name,
      action: "created",
      entityType: "note",
      entityId: note.id,
    });
  }
  res.status(201).json(note);
};
