import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { existsSync } from "fs";
import router from "./routes";
import { logger } from "./lib/logger";
import { startGossipScheduler } from "./lib/gossipScheduler";
import { startGraphCacheRefresh } from "./lib/enrichSites";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

startGossipScheduler();
startGraphCacheRefresh();

if (process.env.NODE_ENV === "production") {
  const publicDir = path.resolve(import.meta.dirname, "public");
  app.use(express.static(publicDir));
  app.get("/{*path}", (_req, res) => {
    const indexPath = path.resolve(publicDir, "index.html");
    if (!existsSync(indexPath)) {
      res.status(404).send("Frontend not built. Run `pnpm --filter @workspace/api-server run build`.");
      return;
    }
    res.sendFile(indexPath);
  });
}

export default app;
