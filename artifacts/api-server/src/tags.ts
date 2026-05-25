import type { Site } from "@workspace/db/schema";
import fs from "fs";
import path from "path";

const TAGS_PATH = path.join(process.cwd(), "../../tags.json");

interface TagsData {
  coreContent: string[];
  vibeWebCulture: string[];
  contentSafety: string[];
  systemTags: string[];
}

function loadTagsData(): TagsData {
  try {
    return JSON.parse(fs.readFileSync(TAGS_PATH, "utf8")) as TagsData;
  } catch {
    return { coreContent: [], vibeWebCulture: [], contentSafety: [], systemTags: [] };
  }
}

export function getTagsData(): TagsData {
  return loadTagsData();
}

export function getUserTags(): Set<string> {
  const data = loadTagsData();
  return new Set([...data.coreContent, ...data.vibeWebCulture, ...data.contentSafety]);
}

export const SYSTEM_TAGS = new Set([
  "orphaned", "highly-connected", "mutual-ring", "hidden-gem",
  "verified", "ghostsite", "island", "fresh", "ancient",
  "just-updated", "12-hours-ago", "24-hours-ago",
]);

const FRESH_MS         = 7  * 24 * 60 * 60 * 1000;
const ANCIENT_MS       = 365 * 24 * 60 * 60 * 1000;
const GHOST_MS         = 90  * 24 * 60 * 60 * 1000;
const ONE_HOUR_MS      = 1       * 60 * 60 * 1000;
const TWELVE_HOURS_MS  = 12      * 60 * 60 * 1000;
const TWENTY_FOUR_MS   = 24      * 60 * 60 * 1000;

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

  if (site.lastSeen) {
    const sinceLastSeen = now.getTime() - site.lastSeen.getTime();
    if (sinceLastSeen < ONE_HOUR_MS)     tags.push("just-updated");
    else if (sinceLastSeen < TWELVE_HOURS_MS)  tags.push("12-hours-ago");
    else if (sinceLastSeen < TWENTY_FOUR_MS)   tags.push("24-hours-ago");
  }
  if (site.ialVerified)                             tags.push("verified");
  if (age < FRESH_MS)                               tags.push("fresh");
  if (age > ANCIENT_MS)                             tags.push("ancient");
  if (!site.lastSeen || now.getTime() - site.lastSeen.getTime() > GHOST_MS)
                                                    tags.push("ghostsite");
  if (inbound.length === 0)                         tags.push("orphaned");
  if (inbound.length >= 5)                          tags.push("highly-connected");
  if (inbound.length <= 2 && mutuals.length >= 1)  tags.push("hidden-gem");
  if (mutuals.length >= 3 && neighbors.length > 0 && mutuals.length === neighbors.length)
                                                    tags.push("mutual-ring");

  if (neighbors.length > 0) {
    const cluster = new Set([site.url, ...neighbors]);
    let isolated = true;

    outer: for (const member of cluster) {
      for (const linker of (inboundMap.get(member) ?? [])) {
        if (!cluster.has(linker)) { isolated = false; break outer; }
      }
      for (const n of (neighborSets.get(member) ?? new Set())) {
        if (!cluster.has(n)) { isolated = false; break outer; }
      }
    }

    if (isolated) tags.push("island");
  }

  return tags;
}
