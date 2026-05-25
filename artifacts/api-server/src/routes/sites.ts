import { Router, type IRouter } from "express";
import { fetchEnrichedSites } from "../lib/enrichSites.js";
import { getTagsData } from "../tags.js";

const router: IRouter = Router();

router.get("/sites", async (req, res) => {
  const sites = await fetchEnrichedSites();

  const rawTags = typeof req.query.tags === "string" ? req.query.tags : null;
  const matchAll = req.query.match === "all";

  if (!rawTags) {
    res.json(sites);
    return;
  }

  const filterTags = rawTags
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const filtered = sites.filter((site) => {
    const allTags = new Set([...(site.tags ?? []), ...site.systemTags]);
    return matchAll
      ? filterTags.every((t) => allTags.has(t))
      : filterTags.some((t) => allTags.has(t));
  });

  res.json(filtered);
});

router.get("/tags", (_req, res) => {
  res.json(getTagsData());
});

export default router;
