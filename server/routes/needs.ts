import { RequestHandler } from "express";
import { CreateNeedSchema, computeNeedPriority, getPriorityLevel } from "../../shared/schema";
import { storage } from "../storage";
import type { Need } from "../../shared/schema";

/** Enrich needs with computed priority score and level */
function enrichNeeds(needs: Need[]) {
  const familyMap = new Map(storage.getAllFamilies().map((f) => [f.id, f]));
  return needs.map((need) => {
    const family = familyMap.get(need.familyId);
    const score = computeNeedPriority(
      need.urgency,
      need.status,
      need.createdAt,
      family?.lastVisitAt,
    );
    return {
      ...need,
      priorityScore: score,
      priorityLevel: getPriorityLevel(score),
    };
  });
}

export const handleGetNeeds: RequestHandler = (_req, res) => {
  const needs = storage.getAllNeeds();
  const enriched = enrichNeeds(needs);
  // Sort by priority score descending (highest priority first)
  enriched.sort((a, b) => b.priorityScore - a.priorityScore);
  res.json(enriched);
};

export const handleGetNeedsByFamily: RequestHandler = (req, res) => {
  const needs = storage.getNeedsByFamily(req.params.familyId as string);
  const enriched = enrichNeeds(needs);
  enriched.sort((a, b) => b.priorityScore - a.priorityScore);
  res.json(enriched);
};

export const handleCreateNeed: RequestHandler = (req, res) => {
  const parsed = CreateNeedSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides", details: parsed.error.flatten() });
    return;
  }
  const need = storage.createNeed(parsed.data);
  res.status(201).json(need);
};

export const handleUpdateNeed: RequestHandler = (req, res) => {
  const need = storage.updateNeed(req.params.id as string, req.body);
  if (!need) {
    res.status(404).json({ error: "Besoin non trouvé" });
    return;
  }
  res.json(need);
};

export const handleDeleteNeed: RequestHandler = (req, res) => {
  const success = storage.deleteNeed(req.params.id as string);
  if (!success) {
    res.status(404).json({ error: "Besoin non trouvé" });
    return;
  }
  res.json({ success: true });
};
