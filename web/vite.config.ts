import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { ServerResponse } from "node:http";
import { loadEnv, type Plugin } from "vite";
import { defineConfig } from "vitest/config";
import { resolveDataFile, type DataSource } from "./dev/resolve-data-path.ts";

const webRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(webRoot, "..");

function dataSource(env: Record<string, string>): DataSource {
  const value = process.env.VITE_DATA ?? env.VITE_DATA;
  return value === "fixtures" ? "fixtures" : "derived";
}

const contentTypes: Record<string, string> = {
  ".json": "application/json; charset=utf-8",
  ".bin": "application/octet-stream",
  ".webp": "image/webp",
  ".png": "image/png",
};

function contentTypeFor(filePath: string): string {
  return contentTypes[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

function sendNotFound(res: ServerResponse): void {
  res.statusCode = 404;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end("Not found");
}

function dataFilesPlugin(source: DataSource): Plugin {
  return {
    name: "truesouth-data",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        try {
          const pathname = req.url?.split("?")[0] ?? "";
          if (pathname !== "/data" && !pathname.startsWith("/data/")) {
            next();
            return;
          }

          const filePath = resolveDataFile(repoRoot, pathname, source);
          if (!filePath) {
            sendNotFound(res);
            return;
          }

          fs.stat(filePath, (error, stat) => {
            if (error || !stat.isFile()) {
              sendNotFound(res);
              return;
            }

            res.statusCode = 200;
            res.setHeader("Content-Type", contentTypeFor(filePath));
            res.setHeader("Content-Length", stat.size);
            const stream = fs.createReadStream(filePath);
            stream.on("error", () => {
              if (!res.headersSent) {
                sendNotFound(res);
                return;
              }
              res.destroy();
            });
            stream.pipe(res);
          });
        } catch {
          if (!res.headersSent) {
            sendNotFound(res);
          }
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, webRoot, "");
  return {
    plugins: [react(), tailwindcss(), dataFilesPlugin(dataSource(env))],
    server: {
      port: 5173,
      proxy: {
        "/api": "http://localhost:8000",
      },
    },
    test: {
      environment: "node",
      include: ["src/**/*.test.ts", "dev/**/*.test.ts"],
    },
  };
});
