import { logger } from "./lib/logger.js";
import app from "./app.js";
import { setupViteDevMiddleware } from "./vite-dev.js";

const rawPort = process.env["PORT"] ?? "8080";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

await setupViteDevMiddleware(app);

app.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error starting standalone dev server");
    process.exit(1);
  }
  logger.info({ port }, "Standalone dev server listening (Express API + Vite HMR)");
});
