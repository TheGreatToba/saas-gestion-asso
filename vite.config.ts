import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { createServer } from "./server";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    fs: {
      allow: [".", "./client", "./shared"],
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**"],
    },
    hmr: process.env.NODE_ENV === "development" ? {
      host: "localhost",
      port: 8080,
      protocol: "ws",
    } : false,
  },
  build: {
    outDir: "dist/spa",
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          query: ["@tanstack/react-query"],
        },
      },
    },
  },
  plugins: [react(), expressPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "@tanstack/react-query",
      "@radix-ui/react-dialog",
      "framer-motion",
    ],
  },
}));

function expressPlugin(): Plugin {
  return {
    name: "express-plugin",
    apply: "serve", // Only apply during development (serve mode)
    configureServer(server) {
      const app = createServer();

      // Déléguer /api et /health à Express en premier (évite 404 Vite sur /api/*).
      const apiPrefix = "/api";
      const healthPath = "/health";
      const handle = (req: any, res: any, next: () => void) => {
        const path = req.url?.split("?")[0] ?? "";
        if (path.startsWith(apiPrefix) || path === healthPath) {
          return app(req, res, next);
        }
        next();
      };
      (server.middlewares as any).stack.unshift({ route: "", handle });
    },
  };
}
