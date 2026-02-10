import { RequestHandler } from "express";
import { CreateVisitNoteSchema } from "../../shared/schema";
import { storage } from "../storage";

export const handleGetNotes: RequestHandler = (req, res) => {
  const notes = storage.getNotesByFamily(req.params.familyId as string);
  const user = (res as any).locals?.user;
  if (user) {
    storage.appendAuditLog({
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
  const parsed = CreateVisitNoteSchema.safeParse({
    ...req.body,
    familyId: req.params.familyId as string,
  });
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Données invalides", details: parsed.error.flatten() });
    return;
  }
  const note = storage.createVisitNote(parsed.data);
  const user = (res as any).locals?.user;
  if (user) {
    storage.appendAuditLog({
      userId: user.id,
      userName: user.name,
      action: "created",
      entityType: "note",
      entityId: note.id,
    });
  }
  res.status(201).json(note);
};
