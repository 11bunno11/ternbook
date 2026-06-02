import { createServer as createViteServer } from "vite";
import path from "path";
import type { Express } from "express";

export async function setupViteDevMiddleware(app: Express): Promise<void> {
  const ternbookRoot = path.resolve(process.cwd(), "../ternbook");

  const vite = await createViteServer({
    configFile: path.resolve(ternbookRoot, "vite.config.ts"),
    root: ternbookRoot,
    server: { middlewareMode: true },
    appType: "spa",
  });

  app.use(vite.middlewares);
}
