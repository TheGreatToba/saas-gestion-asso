import { RequestHandler } from "express";
import { storage } from "../storage";

export const handleSearch: RequestHandler = (req, res) => {
  const q = (req.query.q as string) || "";
  const result = storage.searchGlobal(q);
  const familyMap = new Map(
    storage.getAllFamilies().map((f) => [f.id, f])
  );
  const needsWithFamily = result.needs.map((n) => {
    const family = familyMap.get(n.familyId);
    return {
      ...n,
      familyName: family?.number ? `Famille N° ${family.number}` : family?.responsibleName ?? "Inconnu",
    };
  });
  const aidsWithFamily = result.aids.map((a) => {
    const family = familyMap.get(a.familyId);
    return {
      ...a,
      familyName: family?.number ? `Famille N° ${family.number}` : family?.responsibleName ?? "Inconnu",
    };
  });
  res.json({
    families: result.families,
    needs: needsWithFamily,
    aids: aidsWithFamily,
  });
};
