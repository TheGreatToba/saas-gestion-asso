import { RequestHandler } from "express";
import { storage } from "../storage";

export const handleGetDashboardStats: RequestHandler = (_req, res) => {
  res.json(storage.getDashboardStats());
};

export const handleGetExportData: RequestHandler = (_req, res) => {
  res.json(storage.getExportData());
};
