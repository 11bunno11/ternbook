import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sitesTable } from "@workspace/db/schema";
import { getTagsData, computeSystemTags } from "../tags.js";

const router: IRouter = Router();

router.get("/sites", async (req, res) => {
  const sites = await db.select().from(sitesTable);
  const now = new Date();

  const neighborSets = new Map<string, Set<string>>();
  for (const site of sites) {
    neighborSets.set(site.url, new Set(site.neighbors ?? []));
  }

  const inboundMap = new Map<string, string[]>();
  for (const site of sites) {
    for (const neighborUrl of (site.neighbors ?? [])) {
      const list = inboundMap.get(neighborUrl) ?? [];
      list.push(site.url);
      inboundMap.set(neighborUrl, list);
    }
  }

  const enriched = sites.map((site) => {
    const mutuals = (site.neighbors ?? []).filter((n) =>
      neighborSets.get(n)?.has(site.url) ?? false
    );
    const siteWithMutuals = { ...site, mutuals };
    const systemTags = computeSystemTags(siteWithMutuals, inboundMap, neighborSets, now);
    return { ...siteWithMutuals, systemTags };
  });

  const rawTags = typeof req.query.tags === "string" ? req.query.tags : null;
  const matchAll = req.query.match === "all";

  if (!rawTags) {
    res.json(enriched);
    return;
  }

  const filterTags = rawTags
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const filtered = enriched.filter((site) => {
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
