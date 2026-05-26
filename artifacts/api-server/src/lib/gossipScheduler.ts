import { logger } from "./logger.js";
import { loadGossipConfig, buildBundle } from "../routes/gossip.js";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

async function pushGossip(): Promise<void> {
  const { send } = loadGossipConfig();

  if (send.length === 0) return;

  if (!process.env.TERNBOOK_ORIGIN) {
    logger.warn("gossip scheduler: TERNBOOK_ORIGIN not set, skipping push");
    return;
  }

  let bundle: Awaited<ReturnType<typeof buildBundle>>;
  try {
    bundle = await buildBundle();
  } catch (err) {
    logger.error({ err }, "gossip scheduler: failed to build bundle");
    return;
  }

  if (bundle.site_count === 0) {
    logger.info("gossip scheduler: no sites to gossip");
    return;
  }

  for (const instanceUrl of send) {
    const target = instanceUrl.replace(/\/+$/, "") + "/api/gossip/receive";
    try {
      const res = await fetch(target, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bundle),
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok) {
        const data = await res.json() as { accepted?: number; skipped?: number };
        logger.info({ target, accepted: data.accepted, skipped: data.skipped }, "gossip sent");
      } else {
        const text = await res.text();
        logger.warn({ target, status: res.status, body: text }, "gossip push rejected");
      }
    } catch (err) {
      logger.error({ err, target }, "gossip push failed");
    }
  }
}

export function startGossipScheduler(): void {
  // First push after 5 minutes (allow server to fully settle), then every 6 hours
  setTimeout(() => {
    void pushGossip();
    setInterval(() => { void pushGossip(); }, SIX_HOURS_MS);
  }, 5 * 60 * 1000);

  logger.info("gossip scheduler started (first push in 5 min, then every 6h)");
}
