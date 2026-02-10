import { RequestHandler } from "express";
import { storage } from "../storage";

export const handleSearch: RequestHandler = (req, res) => {
  const q = (req.query.q as string) || "";
  const result = storage.searchGlobal(q);
  const familyMap = new Map(
    storage.getAllFamilies().map((f) => [f.id, f])
  );
  const needsWithFamily = result.needs.map((n) => ({
    ...n,
    familyName: familyMap.get(n.familyId)?.responsibleName ?? "Inconnu",
  }));
  const aidsWithFamily = result.aids.map((a) => ({
    ...a,
    familyName: familyMap.get(a.familyId)?.responsibleName ?? "Inconnu",
  }));
  res.json({
    families: result.families,
    needs: needsWithFamily,
    aids: aidsWithFamily,
  });
};
