import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sitesTable } from "@workspace/db/schema";

const router: IRouter = Router();

router.get("/sites", async (_req, res) => {
  const sites = await db.select().from(sitesTable);

  // Build a lookup: url → set of that site's neighbors
  const neighborSets = new Map<string, Set<string>>();
  for (const site of sites) {
    neighborSets.set(site.url, new Set(site.neighbors ?? []));
  }

  // For each site, mutuals = neighbors that also list this site back
  const withMutuals = sites.map((site) => {
    const mutuals = (site.neighbors ?? []).filter((neighborUrl) => {
      const theirNeighbors = neighborSets.get(neighborUrl);
      return theirNeighbors?.has(site.url) ?? false;
    });
    return { ...site, mutuals };
  });

  res.json(withMutuals);
});

export default router;
