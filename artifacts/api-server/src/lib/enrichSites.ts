import { db } from "@workspace/db";
import { sitesTable } from "@workspace/db/schema";
import { computeSystemTags } from "../tags.js";

export type EnrichedSite = Awaited<ReturnType<typeof fetchEnrichedSites>>[number];

export async function fetchEnrichedSites() {
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

  return sites.map((site) => {
    const mutuals = (site.neighbors ?? []).filter(
      (n) => neighborSets.get(n)?.has(site.url) ?? false
    );
    const siteWithMutuals = { ...site, mutuals };
    const systemTags = computeSystemTags(siteWithMutuals, inboundMap, neighborSets, now);
    return { ...siteWithMutuals, systemTags };
  });
}
