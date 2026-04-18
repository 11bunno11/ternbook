import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sitesTable } from "@workspace/db/schema";
import { eq, and, ne } from "drizzle-orm";
import crypto from "crypto";
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

function generateIAL(url: string, registeredAt: Date): string {
  const hostname = new URL(url).hostname;
  return crypto
    .createHash("sha256")
    .update(hostname + registeredAt.toISOString())
    .digest("hex");
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

  // check rate limit
  if (!isExempt) {
    const [existing] = await db
      .select({ lastSeen: sitesTable.lastSeen })
      .from(sitesTable)
      .where(eq(sitesTable.url, normalizedUrl));

    if (existing?.lastSeen) {
      const elapsed = Date.now() - existing.lastSeen.getTime();
      if (elapsed < RATE_LIMIT_MS) {
        const retryAfterMins = Math.ceil((RATE_LIMIT_MS - elapsed) / 60000);
        res.status(429).json({ error: "rate limited", retryAfterMinutes: retryAfterMins });
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

  // look up existing record to get registeredAt (or set it now for new sites)
  const [currentSite] = await db
    .select({ registeredAt: sitesTable.registeredAt, ial: sitesTable.ial })
    .from(sitesTable)
    .where(eq(sitesTable.url, normalizedUrl));

  const registeredAt = currentSite?.registeredAt ?? new Date();
  const ial = generateIAL(normalizedUrl, registeredAt);

  // verify IAL if the site sent one
  const sentIAL = (data.ial as string) ?? null;
  if (sentIAL && sentIAL !== ial) {
    res.status(403).json({ error: "ial code mismatch" });
    return;
  }

  // duplicate IAL check — newer registered site loses
  if (currentSite === undefined) {
    // new site: check if the generated IAL is already claimed (extremely unlikely but safe)
    const [ialConflict] = await db
      .select({ url: sitesTable.url, registeredAt: sitesTable.registeredAt })
      .from(sitesTable)
      .where(and(eq(sitesTable.ial, ial), ne(sitesTable.url, normalizedUrl)));

    if (ialConflict) {
      res.status(409).json({ error: "ial code conflict with an existing site" });
      return;
    }
  }

  await db
    .insert(sitesTable)
    .values({
      url: normalizedUrl,
      name: data.name as string,
      description: (data.description as string) ?? null,
      tags: (data.tags as string[]) ?? null,
      neighbors: (data.neighbors as string[]) ?? null,
      ial,
      heartbeat: data.heartbeat ? new Date(data.heartbeat as string) : null,
      lastSeen: new Date(),
      registeredAt,
    })
    .onConflictDoUpdate({
      target: sitesTable.url,
      set: {
        name: data.name as string,
        description: (data.description as string) ?? null,
        tags: (data.tags as string[]) ?? null,
        neighbors: (data.neighbors as string[]) ?? null,
        ial,
        heartbeat: data.heartbeat ? new Date(data.heartbeat as string) : null,
        lastSeen: new Date(),
        // registeredAt intentionally not updated
      },
    });

  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  fs.appendFileSync(
    path.join(process.cwd(), "../../requesttimes.txt"),
    `crawl requested on ${timestamp} for ${normalizedUrl}\n`
  );

  res.json({ ok: true, url: normalizedUrl, ial });
});

export default router;
