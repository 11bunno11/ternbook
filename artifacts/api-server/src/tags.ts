import type { Site } from "@workspace/db/schema";

export const USER_TAGS = new Set([
  // Core Content
  "blog", "portfolio", "wiki", "personal", "project", "archive", "docs",
  "forum", "social", "indie", "startup", "tools", "search", "media",
  "gallery", "journal", "experiments", "learning", "education", "gaming",
  "music", "art", "writing", "photography", "coding", "devlog", "maps",
  "recipes", "news", "links", "directory", "microblog",
  // Vibe / Web Culture
  "web1", "webcore", "y2k", "cyberpunk", "minimal", "brutalist", "retro",
  "terminal", "weirdweb", "handmade", "cozy", "chaotic", "aesthetic",
  "oldnet", "lowtech", "experimental", "glitch", "vaporwave",
  // Content Safety
  "nsfw", "political", "ads", "ai-generated", "satire",
]);

export const SYSTEM_TAGS = new Set([
  "orphaned", "highly-connected", "mutual-ring", "hidden-gem",
  "verified", "ghostsite", "island", "fresh", "ancient",
]);

const FRESH_MS    = 7   * 24 * 60 * 60 * 1000;
const ANCIENT_MS  = 365 * 24 * 60 * 60 * 1000;
const GHOST_MS    = 90  * 24 * 60 * 60 * 1000;

export function computeSystemTags(
  site: Site & { mutuals: string[] },
  inboundMap: Map<string, string[]>,
  neighborSets: Map<string, Set<string>>,
  now: Date,
): string[] {
  const tags: string[] = [];
  const inbound   = inboundMap.get(site.url) ?? [];
  const neighbors = site.neighbors ?? [];
  const { mutuals } = site;
  const age = now.getTime() - (site.registeredAt?.getTime() ?? now.getTime());

  if (site.ialVerified)                              tags.push("verified");
  if (age < FRESH_MS)                                tags.push("fresh");
  if (age > ANCIENT_MS)                              tags.push("ancient");
  if (!site.lastSeen || now.getTime() - site.lastSeen.getTime() > GHOST_MS)
                                                     tags.push("ghostsite");
  if (inbound.length === 0)                          tags.push("orphaned");
  if (inbound.length >= 5)                           tags.push("highly-connected");
  if (inbound.length <= 2 && mutuals.length >= 1)   tags.push("hidden-gem");
  if (mutuals.length >= 3 && neighbors.length > 0 && mutuals.length === neighbors.length)
                                                     tags.push("mutual-ring");

  // island: the cluster {site ∪ neighbors} has no links in or out from the rest
  if (neighbors.length > 0) {
    const cluster = new Set([site.url, ...neighbors]);
    let isolated = true;

    outer: for (const member of cluster) {
      // any inbound from outside the cluster?
      for (const linker of (inboundMap.get(member) ?? [])) {
        if (!cluster.has(linker)) { isolated = false; break outer; }
      }
      // any outbound to outside the cluster?
      for (const n of (neighborSets.get(member) ?? new Set())) {
        if (!cluster.has(n)) { isolated = false; break outer; }
      }
    }

    if (isolated) tags.push("island");
  }

  return tags;
}
