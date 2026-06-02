import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sitesTable } from "@workspace/db/schema";
import { gte, sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { currentEpoch } from "../lib/epoch.js";
import { loadBlacklist } from "../lib/blacklist.js";

const router: IRouter = Router();

const GOSSIP_PATH  = path.join(process.cwd(), "../../gossip.json");
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const PAYLOAD_VERSION = "1.0";

interface GossipConfig {
  send: string[];
  receive: string[];
}

export function loadGossipConfig(): GossipConfig {
  try {
    return JSON.parse(fs.readFileSync(GOSSIP_PATH, "utf8")) as GossipConfig;
  } catch {
    return { send: [], receive: [] };
  }
}

async function buildBundle() {
  const since = new Date(Date.now() - SIX_HOURS_MS);
  const sites = await db
    .select({ url: sitesTable.url, lastSeen: sitesTable.lastSeen })
    .from(sitesTable)
    .where(gte(sitesTable.lastSeen, since));

  const epoch = currentEpoch();
  return {
    gossip_origin: process.env.TERNBOOK_ORIGIN ?? null,
    gossip_timestamp: new Date().toISOString(),
    payload_version: PAYLOAD_VERSION,
    site_count: sites.length,
    sites: sites.map((s) => ({
      url: s.url,
      last_heartbeat_at: s.lastSeen?.toISOString() ?? null,
      observed_epoch: epoch,
    })),
  };
}

// GET /api/gossip/send — other instances pull our recent-heartbeat bundle
router.get("/gossip/send", async (req, res) => {
  if (!process.env.TERNBOOK_ORIGIN) {
    res.status(503).json({ error: "TERNBOOK_ORIGIN env var is not set on this instance" });
    return;
  }
  const bundle = await buildBundle();
  res.json(bundle);
});

// POST /api/gossip/receive — accept a bundle from another instance
router.post("/gossip/receive", async (req, res) => {
  const body = req.body as Record<string, unknown>;

  const origin = body.gossip_origin;
  if (typeof origin !== "string" || !origin) {
    res.status(400).json({ error: "gossip_origin is required" });
    return;
  }

  // Whitelist check
  const { receive } = loadGossipConfig();
  if (!receive.includes(origin)) {
    res.status(403).json({ error: `${origin} is not in this instance's receive list` });
    return;
  }

  if (body.payload_version !== PAYLOAD_VERSION) {
    res.status(422).json({ error: `unsupported payload_version "${body.payload_version}", expected "${PAYLOAD_VERSION}"` });
    return;
  }

  const sites = body.sites;
  if (!Array.isArray(sites)) {
    res.status(400).json({ error: "sites must be an array" });
    return;
  }

  let accepted = 0;
  let skipped  = 0;

  const blacklist = loadBlacklist();

  for (const entry of sites) {
    if (!entry || typeof entry !== "object") continue;
    const { url, last_heartbeat_at } = entry as Record<string, unknown>;

    if (typeof url !== "string") continue;

    const normalizedUrl = url.replace(/\/+$/, "");
    if (blacklist.has(normalizedUrl)) { skipped++; continue; }

    let parsedUrl: URL;
    try { parsedUrl = new URL(url); } catch { continue; }
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") continue;

    const lastSeen = typeof last_heartbeat_at === "string"
      ? new Date(last_heartbeat_at)
      : new Date();

    const hostname = parsedUrl.hostname;

    // Insert only if new; if already known locally (sourceInstance IS NULL) leave it alone.
    // If it's already an external site, update lastSeen if gossip is more recent.
    const result = await db
      .insert(sitesTable)
      .values({
        url: normalizedUrl,
        name: hostname,
        lastSeen,
        sourceInstance: origin,
      })
      .onConflictDoUpdate({
        target: sitesTable.url,
        set: {
          lastSeen,
          sourceInstance: origin,
        },
        setWhere: sql`${sitesTable.sourceInstance} IS NOT NULL`,
      })
      .returning({ url: sitesTable.url });

    if (result.length > 0) accepted++;
    else skipped++;
  }

  res.json({ ok: true, accepted, skipped });
});

export { buildBundle };
export default router;
