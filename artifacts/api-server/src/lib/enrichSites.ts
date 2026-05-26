import { db } from "@workspace/db";
import { sitesTable, type Site } from "@workspace/db/schema";
import { computeStructuralTags, computeDynamicTags } from "../tags.js";
import { logger } from "./logger.js";

// ---------------------------------------------------------------------------
// Graph cache — structural tags recomputed every 30 minutes (or on demand).
// Dynamic (time/attribute) tags computed fresh per request — no DB hit.
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 30 * 60 * 1000;

interface CachedEntry {
  site: Site;
  mutuals: string[];
  structuralTags: string[];
}

interface GraphCache {
  entries: CachedEntry[];
  builtAt: number;
}

let cache: GraphCache | null = null;
let rebuilding = false;

async function buildCache(): Promise<GraphCache> {
  const sites = await db.select().from(sitesTable);

  const neighborSets = new Map<string, Set<string>>();
  for (const site of sites) {
    neighborSets.set(site.url, new Set(site.neighbors ?? []));
  }

  const inboundMap = new Map<string, string[]>();
  for (const site of sites) {
    for (const neighbor of (site.neighbors ?? [])) {
      const list = inboundMap.get(neighbor) ?? [];
      list.push(site.url);
      inboundMap.set(neighbor, list);
    }
  }

  const entries: CachedEntry[] = sites.map((site) => {
    const mutuals = (site.neighbors ?? []).filter(
      (n) => neighborSets.get(n)?.has(site.url) ?? false,
    );
    const structuralTags = computeStructuralTags(
      { ...site, mutuals },
      inboundMap,
      neighborSets,
    );
    return { site, mutuals, structuralTags };
  });

  return { entries, builtAt: Date.now() };
}

async function getCache(): Promise<GraphCache> {
  if (cache && Date.now() - cache.builtAt < CACHE_TTL_MS) return cache;

  // Only one rebuild at a time; if one is already in progress, serve stale cache
  if (rebuilding && cache) return cache;

  rebuilding = true;
  try {
    cache = await buildCache();
  } finally {
    rebuilding = false;
  }
  return cache;
}

/** Mark cache stale so the next request triggers a rebuild. */
export function invalidateGraphCache(): void {
  if (cache) cache.builtAt = 0;
}

/** Background refresh — keeps cache warm between requests. */
export function startGraphCacheRefresh(): void {
  setInterval(async () => {
    try {
      cache = await buildCache();
      logger.debug("graph cache refreshed");
    } catch (err) {
      logger.error({ err }, "graph cache background refresh failed");
    }
  }, CACHE_TTL_MS);
}

export type EnrichedSite = Awaited<ReturnType<typeof fetchEnrichedSites>>[number];

export async function fetchEnrichedSites() {
  const { entries } = await getCache();
  const now = new Date();

  return entries.map(({ site, mutuals, structuralTags }) => ({
    ...site,
    mutuals,
    systemTags: [...structuralTags, ...computeDynamicTags(site, now)],
  }));
}
