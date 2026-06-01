import { Router, type IRouter } from "express";
import { fetchEnrichedSites } from "../lib/enrichSites.js";
import { getTagsData } from "../tags.js";

const router: IRouter = Router();
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

router.get("/sites", async (req, res) => {
  const sites = await fetchEnrichedSites();

  const rawTags  = typeof req.query.tags  === "string" ? req.query.tags  : null;
  const matchAll = req.query.match === "all";
  const page     = Math.max(1, parseInt(String(req.query.page  ?? "1"),  10) || 1);
  const limit    = Math.min(MAX_LIMIT, Math.max(1, parseInt(String(req.query.limit ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));

  const filterTags = rawTags
    ? rawTags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean)
    : [];

  const visible = sites.filter((s) => {
    if (s.isHidden) return false;
    if (filterTags.length === 0) return true;
    const allTags = new Set([...(s.tags ?? []), ...s.systemTags]);
    return matchAll
      ? filterTags.every((t) => allTags.has(t))
      : filterTags.some((t) => allTags.has(t));
  });

  const total  = visible.length;
  const pages  = Math.max(1, Math.ceil(total / limit));
  const offset = (page - 1) * limit;
  const slice  = visible.slice(offset, offset + limit);

  res.json({ sites: slice, total, page, limit, pages });
});

router.get("/tags", (_req, res) => {
  res.json(getTagsData());
});

export default router;
