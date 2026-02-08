import { RequestHandler } from "express";
import { CreateVisitNoteSchema } from "../../shared/schema";
import { storage } from "../storage";

export const handleGetNotes: RequestHandler = (req, res) => {
  res.json(storage.getNotesByFamily(req.params.familyId as string));
};

export const handleCreateNote: RequestHandler = (req, res) => {
  const parsed = CreateVisitNoteSchema.safeParse({
    ...req.body,
    familyId: req.params.familyId as string,
  });
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides", details: parsed.error.flatten() });
    return;
  }
  const note = storage.createVisitNote(parsed.data);
  res.status(201).json(note);
};
