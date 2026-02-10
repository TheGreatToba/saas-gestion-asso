import { RequestHandler } from "express";
import { storage } from "../storage";

export const handleGetDashboardStats: RequestHandler = (_req, res) => {
  res.json(storage.getDashboardStats());
};

export const handleGetExportData: RequestHandler = (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const offset = req.query.offset ? Number(req.query.offset) : undefined;

  if (
    (limit !== undefined && (Number.isNaN(limit) || limit <= 0)) ||
    (offset !== undefined && (Number.isNaN(offset) || offset < 0))
  ) {
    res.status(400).json({ error: "Paramètres de pagination invalides" });
    return;
  }

  const result = storage.getExportData({
    limit: limit ?? 200,
    offset: offset ?? 0,
  });

  res.json(result);
};
