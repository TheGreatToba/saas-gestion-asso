import { RequestHandler } from "express";
import { storage } from "../storage";

const SEARCH_LIMIT = 100;

function getOrgId(res: any): string {
  return (res.locals?.user as { organizationId?: string } | undefined)?.organizationId ?? "org-default";
}

export const handleSearch: RequestHandler = (req, res) => {
  const orgId = getOrgId(res);
  const q = (req.query.q as string) || "";
  const limit = Math.min(
    Math.max(1, Number(req.query.limit) || SEARCH_LIMIT),
    200,
  );
  const result = storage.searchGlobal(orgId, q, limit);
  const familyMap = new Map(
    result.families.map((f) => [f.id, f]),
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
