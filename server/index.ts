import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { handleLogin, handleGetUsers } from "./routes/auth";
import {
  handleGetFamilies,
  handleGetFamily,
  handleCreateFamily,
  handleUpdateFamily,
  handleDeleteFamily,
} from "./routes/families";
import { handleGetChildren, handleCreateChild, handleUpdateChild, handleDeleteChild } from "./routes/children";
import { handleGetNeeds, handleGetNeedsByFamily, handleCreateNeed, handleUpdateNeed, handleDeleteNeed } from "./routes/needs";
import { handleGetAids, handleGetAidsByFamily, handleCreateAid } from "./routes/aids";
import { handleGetNotes, handleCreateNote } from "./routes/notes";
import { handleGetDashboardStats, handleGetExportData } from "./routes/dashboard";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Legacy routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });
  app.get("/api/demo", handleDemo);

  // Auth
  app.post("/api/auth/login", handleLogin);
  app.get("/api/users", handleGetUsers);

  // Dashboard
  app.get("/api/dashboard/stats", handleGetDashboardStats);
  app.get("/api/export", handleGetExportData);

  // Families
  app.get("/api/families", handleGetFamilies);
  app.post("/api/families", handleCreateFamily);
  app.get("/api/families/:id", handleGetFamily);
  app.put("/api/families/:id", handleUpdateFamily);
  app.delete("/api/families/:id", handleDeleteFamily);

  // Children (nested under families)
  app.get("/api/families/:familyId/children", handleGetChildren);
  app.post("/api/families/:familyId/children", handleCreateChild);
  app.put("/api/children/:id", handleUpdateChild);
  app.delete("/api/children/:id", handleDeleteChild);

  // Needs
  app.get("/api/needs", handleGetNeeds);
  app.post("/api/needs", handleCreateNeed);
  app.put("/api/needs/:id", handleUpdateNeed);
  app.delete("/api/needs/:id", handleDeleteNeed);
  app.get("/api/families/:familyId/needs", handleGetNeedsByFamily);

  // Aids
  app.get("/api/aids", handleGetAids);
  app.post("/api/aids", handleCreateAid);
  app.get("/api/families/:familyId/aids", handleGetAidsByFamily);

  // Visit Notes
  app.get("/api/families/:familyId/notes", handleGetNotes);
  app.post("/api/families/:familyId/notes", handleCreateNote);

  return app;
}
