import { inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import { sitesTable } from "@workspace/db/schema";
import { invalidateGraphCache } from "./enrichSites.js";
import { logger } from "./logger.js";
import { hasDurationElapsed, TERNBOOK_CONFIG } from "./ternbookConfig.js";

const FIRST_SWEEP_DELAY_MS = 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

async function deleteInactiveSites(): Promise<void> {
  try {
    const now = new Date();
    const sites = await db
      .select({
        url: sitesTable.url,
        lastSeen: sitesTable.lastSeen,
        registeredAt: sitesTable.registeredAt,
      })
      .from(sitesTable);

    const expiredUrls = sites
      .filter((site) =>
        hasDurationElapsed(
          site.lastSeen ?? site.registeredAt,
          TERNBOOK_CONFIG.InactivityDelete,
          now,
        ),
      )
      .map((site) => site.url);

    if (expiredUrls.length === 0) return;

    await db.delete(sitesTable).where(inArray(sitesTable.url, expiredUrls));
    invalidateGraphCache();
    logger.info({ deleted: expiredUrls.length }, "inactive sites deleted");
  } catch (err) {
    logger.error({ err }, "inactivity cleanup failed");
  }
}

export function startInactivityScheduler(): void {
  setTimeout(() => {
    void deleteInactiveSites();
    setInterval(() => void deleteInactiveSites(), SWEEP_INTERVAL_MS);
  }, FIRST_SWEEP_DELAY_MS);
}
