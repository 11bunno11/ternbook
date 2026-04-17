import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sitesTable } from "@workspace/db/schema";
import { eq, and, ne } from "drizzle-orm";
import fs from "fs";
import path from "path";

const router: IRouter = Router();
const RATE_LIMIT_MS = 12 * 60 * 60 * 1000;
const EXCEPTIONS_PATH = path.join(process.cwd(), "../../exceptions.json");

function loadExceptions(): string[] {
  try {
    return JSON.parse(fs.readFileSync(EXCEPTIONS_PATH, "utf8"));
  } catch {
    return [];
  }
}

async function fetchSiteData(baseUrl: string) {
  const res = await fetch(baseUrl + "/.well-known/ternbook.json", {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) throw new Error("bad response");

  return res.json();
}

function validate(data: Record<string, unknown>, baseUrl: string): boolean {
  if (!data || typeof data !== "object") return false;
  if (!data.name || !data.url) return false;
  if (data.url !== baseUrl) return false;
  if (Array.isArray(data.tags) && data.tags.length > 10) return false;
  if (Array.isArray(data.neighbors) && data.neighbors.length > 20) return false;
  return true;
}

router.post("/heartbeat", async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "url is required" });
    return;
  }

  const normalizedUrl = url.replace(/\/+$/, "");
  const exceptions = loadExceptions();
  const isExempt = exceptions.includes(normalizedUrl);

  if (!isExempt) {
    const [existing] = await db
      .select({ lastSeen: sitesTable.lastSeen })
      .from(sitesTable)
      .where(eq(sitesTable.url, normalizedUrl));

    if (existing?.lastSeen) {
      const elapsed = Date.now() - existing.lastSeen.getTime();
      if (elapsed < RATE_LIMIT_MS) {
        const retryAfterMins = Math.ceil((RATE_LIMIT_MS - elapsed) / 60000);
        res.status(429).json({
          error: "rate limited",
          retryAfterMinutes: retryAfterMins,
        });
        return;
      }
    }
  }

  let data: Record<string, unknown>;

  try {
    data = await fetchSiteData(normalizedUrl);
  } catch (err) {
    req.log.warn({ err, url: normalizedUrl }, "failed to fetch ternbook.json");
    res.status(422).json({ error: "could not fetch ternbook.json from that url" });
    return;
  }

  if (!validate(data, normalizedUrl)) {
    res.status(422).json({ error: "ternbook.json is invalid" });
    return;
  }

  // duplicate nb check — if another site has the same nb, the newer one loses
  const nbCode = (data.nb as string) ?? null;
  if (nbCode) {
    const [nbConflict] = await db
      .select({ url: sitesTable.url, registeredAt: sitesTable.registeredAt })
      .from(sitesTable)
      .where(and(eq(sitesTable.nb, nbCode), ne(sitesTable.url, normalizedUrl)));

    if (nbConflict) {
      const [currentSite] = await db
        .select({ registeredAt: sitesTable.registeredAt })
        .from(sitesTable)
        .where(eq(sitesTable.url, normalizedUrl));

      const currentRegistered = currentSite?.registeredAt ?? new Date();
      const conflictRegistered = nbConflict.registeredAt;

      if (currentRegistered > conflictRegistered) {
        // current site registered later — it loses
        res.status(409).json({ error: "nb code already claimed by an earlier site" });
        return;
      } else {
        // conflicting site registered later — delete it
        req.log.warn({ url: nbConflict.url }, "removing duplicate nb code site");
        await db.delete(sitesTable).where(eq(sitesTable.url, nbConflict.url));
      }
    }
  }

  await db
    .insert(sitesTable)
    .values({
      url: data.url as string,
      name: data.name as string,
      description: (data.description as string) ?? null,
      tags: (data.tags as string[]) ?? null,
      neighbors: (data.neighbors as string[]) ?? null,
      nb: nbCode,
      heartbeat: data.heartbeat ? new Date(data.heartbeat as string) : null,
      lastSeen: new Date(),
    })
    .onConflictDoUpdate({
      target: sitesTable.url,
      set: {
        name: data.name as string,
        description: (data.description as string) ?? null,
        tags: (data.tags as string[]) ?? null,
        neighbors: (data.neighbors as string[]) ?? null,
        nb: nbCode,
        heartbeat: data.heartbeat ? new Date(data.heartbeat as string) : null,
        lastSeen: new Date(),
        // registeredAt is intentionally not updated here
      },
    });

  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  fs.appendFileSync(
    path.join(process.cwd(), "../../requesttimes.txt"),
    `crawl requested on ${timestamp} for ${normalizedUrl}\n`
  );

  res.json({ ok: true, url: normalizedUrl });
});

export default router;
