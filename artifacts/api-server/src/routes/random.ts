import { Router, type IRouter } from "express";
import { fetchEnrichedSites } from "../lib/enrichSites.js";

const router: IRouter = Router();

router.get("/random", async (req, res) => {
  const tag = typeof req.query.tag === "string" ? req.query.tag.trim().toLowerCase() : null;

  const sites = await fetchEnrichedSites();

  const pool = tag
    ? sites.filter((s) => {
        const all = new Set([...(s.tags ?? []), ...s.systemTags]);
        return all.has(tag);
      })
    : sites;

  if (pool.length === 0) {
    res.status(404).json({ error: tag ? `no sites found with tag "${tag}"` : "no sites in the directory" });
    return;
  }

  const pick = pool[Math.floor(Math.random() * pool.length)];
  res.json({ url: pick.url, name: pick.name, description: pick.description, tags: pick.tags, systemTags: pick.systemTags });
});

export default router;
