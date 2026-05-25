import { Router, type IRouter } from "express";
import { fetchEnrichedSites } from "../lib/enrichSites.js";

const router: IRouter = Router();

const MAP_IN = new Set(["in", "join"]);

router.get("/map", async (_req, res) => {
  const all = await fetchEnrichedSites();
  const onMap = all.filter((s) => s.mapStatus && MAP_IN.has(s.mapStatus));
  const onMapUrls = new Set(onMap.map((s) => s.url));

  const nodes = onMap.map((s) => ({
    id: s.url,
    name: s.name,
    url: s.url,
    description: s.description,
    tags: s.tags ?? [],
    systemTags: s.systemTags,
    mutuals: s.mutuals,
    neighborCount: (s.neighbors ?? []).length,
    inboundCount: all.filter((o) => (o.neighbors ?? []).includes(s.url)).length,
  }));

  // Only links where both endpoints are on the map (deduplicated)
  const seen = new Set<string>();
  const links: { source: string; target: string }[] = [];

  for (const site of onMap) {
    for (const neighbor of (site.neighbors ?? [])) {
      if (!onMapUrls.has(neighbor)) continue;
      const key = [site.url, neighbor].sort().join("||");
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({ source: site.url, target: neighbor });
    }
  }

  res.json({ nodes, links });
});

export default router;
