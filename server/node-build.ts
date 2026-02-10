import path from "path";
import { createServer } from "./index";
import * as express from "express";

const app = createServer();
const port = process.env.PORT || 3000;

// In production, serve the built SPA files
const __dirname = import.meta.dirname;
const distPath = path.join(__dirname, "../spa");

// 1. Fichiers statiques (assets, index.html pour "/") — doit rester en premier
app.use(express.static(distPath));

// 2. Fallback SPA : tout le reste (sauf /api, /health, /assets) → index.html
// Ne jamais renvoyer index.html pour /assets/* (fichiers statiques)
app.use((req, res, next) => {
  if (
    req.path.startsWith("/api/") ||
    req.path === "/health" ||
    req.path.startsWith("/assets/")
  )
    return next();
  const indexPath = path.join(distPath, "index.html");
  res.sendFile(indexPath, (err) => {
    if (err) next(err);
  });
});

app.listen(port, () => {
  console.log(`🚀 Fusion Starter server running on port ${port}`);
  console.log(`📱 Frontend: http://localhost:${port}`);
  console.log(`🔧 API: http://localhost:${port}/api`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 Received SIGTERM, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🛑 Received SIGINT, shutting down gracefully");
  process.exit(0);
});
