import { RequestHandler } from "express";
import { storage } from "../storage";

export const handleGetAuditLogs: RequestHandler = (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 200);
  const logs = storage.getAuditLogs(limit);
  res.json(logs);
};
