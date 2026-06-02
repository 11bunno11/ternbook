import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sitesTable } from "@workspace/db/schema";
import { eq, and, ne, gt } from "drizzle-orm";
import crypto from "crypto";
import dns from "dns";
import fs from "fs";
import path from "path";
import net from "net";
import { getUserTags } from "../tags.js";
import { currentEpoch } from "../lib/epoch.js";
import { invalidateGraphCache } from "../lib/enrichSites.js";
import { isBlacklisted } from "../lib/blacklist.js";

const router: IRouter = Router();
const RATE_LIMIT_MS = 12 * 60 * 60 * 1000;
const EXCEPTIONS_PATH = path.join(process.cwd(), "../../exceptions.json");
const MAX_NEIGHBORS = parseInt(process.env.MAX_NEIGHBORS ?? "64", 10);
const IAL_HEX_LENGTH = 64; // HMAC-SHA256 hex output

function loadExceptions(): string[] {
  try {
    return JSON.parse(fs.readFileSync(EXCEPTIONS_PATH, "utf8"));
  } catch {
    return [];
  }
}

function generateIAL(url: string, registeredAt: Date, epoch: number): string {
  const secret = process.env.IAL_SECRET;
  if (!secret) throw new Error("IAL_SECRET environment variable is not set");
  const hostname = new URL(url).hostname;
  return crypto
    .createHmac("sha256", secret)
    .update(`${hostname}${registeredAt.toISOString()}:${epoch}`)
    .digest("hex");
}

function isPrivateIP(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    const [a, b] = parts;
    if (a === 0) return true;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 198 && b === 18) return true;
    if (a === 198 && b === 19) return true;
    return false;
  }

  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    if (normalized === "::1") return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
    if (normalized.startsWith("fe80")) return true;
    if (normalized.startsWith("::ffff:")) {
      const v4 = normalized.slice(7);
      if (net.isIPv4(v4)) return isPrivateIP(v4);
    }
    return false;
  }

  return true;
}

async function resolveAndCheckIP(hostname: string): Promise<void> {
  let addresses: string[] = [];

  try {
    const v4 = await dns.promises.resolve4(hostname).catch(() => [] as string[]);
    const v6 = await dns.promises.resolve6(hostname).catch(() => [] as string[]);
    addresses = [...v4, ...v6];
  } catch {
    throw new Error(`dns resolution failed for ${hostname}`);
  }

  if (addresses.length === 0) {
    throw new Error(`no dns records found for ${hostname}`);
  }

  for (const ip of addresses) {
    if (isPrivateIP(ip)) {
      throw new Error(`hostname ${hostname} resolves to private IP ${ip}`);
    }
  }
}

function hasControlChars(str: string): boolean {
  for (let i = 0; i < str.length; i++) {
    const cp = str.codePointAt(i)!;
    if (cp <= 0x08) return true;
    if (cp === 0x0b || cp === 0x0c) return true;
    if (cp >= 0x0e && cp <= 0x1f) return true;
    if (cp === 0x7f) return true;
    if (cp >= 0x80 && cp <= 0x9f) return true;
    if (cp === 0x200b || cp === 0x200c || cp === 0x200d) return true;
    if (cp === 0xfeff) return true;
    if (cp >= 0x2060 && cp <= 0x2064) return true;
    if (cp >= 0xe000 && cp <= 0xf8ff) return true;
  }
  return false;
}

function validateString(val: unknown, maxLen: number, field: string): string | null {
  if (typeof val !== "string") return `${field} must be a string`;
  if (val.length > maxLen) return `${field} exceeds ${maxLen} character limit`;
  if (hasControlChars(val)) return `${field} contains invalid characters`;
  return null;
}

function validateData(data: Record<string, unknown>, baseUrl: string): string | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return "ternbook.json must be a JSON object";
  }

  const nameErr = validateString(data.name, 64, "name");
  if (nameErr) return nameErr;
  if (!(data.name as string).trim()) return "name must not be empty";

  if (typeof data.url !== "string") return "url must be a string";
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(data.url as string);
  } catch {
    return "url is not a valid URL";
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return "url must use http or https";
  }
  const normalizedDataUrl = (data.url as string).replace(/\/+$/, "");
  if (normalizedDataUrl !== baseUrl) return "url does not match the registered site url";

  if (data.description !== undefined && data.description !== null) {
    const descErr = validateString(data.description, 256, "description");
    if (descErr) return descErr;
  }

  if (data.tags !== undefined && data.tags !== null) {
    if (!Array.isArray(data.tags)) return "tags must be an array";
    if (data.tags.length > 10) return "tags exceeds 10 item limit";
    for (const tag of data.tags) {
      const tagErr = validateString(tag, 64, "tag");
      if (tagErr) return tagErr;
      if (!getUserTags().has(tag)) return `unknown tag: "${tag}" — see /api/tags for the allowed list`;
    }
  }

  if (data.neighbors !== undefined && data.neighbors !== null) {
    if (!Array.isArray(data.neighbors)) return "neighbors must be an array";
    if (data.neighbors.length > MAX_NEIGHBORS) return `neighbors exceeds ${MAX_NEIGHBORS} item limit`;
    for (const neighbor of data.neighbors) {
      if (typeof neighbor !== "string") return "each neighbor must be a string";
      try {
        const n = new URL(neighbor);
        if (n.protocol !== "http:" && n.protocol !== "https:") {
          return "neighbor urls must use http or https";
        }
      } catch {
        return `invalid neighbor url: ${neighbor}`;
      }
    }
  }

  if (data.ial !== undefined && data.ial !== null) {
    if (typeof data.ial !== "string") return "ial must be a string";
  }

  if (data.map !== undefined && data.map !== null) {
    if (!["in", "out", "join"].includes(data.map as string)) {
      return 'map must be "in", "join", or "out"';
    }
  }

  return null;
}

async function fetchSiteData(baseUrl: string): Promise<Record<string, unknown>> {
  const res = await fetch(baseUrl + "/.well-known/ternbook.json", {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) throw new Error(`bad response: ${res.status}`);

  const finalUrl = new URL(res.url);
  const expectedHostname = new URL(baseUrl).hostname;

  if (finalUrl.hostname !== expectedHostname) {
    throw new Error(`redirect domain mismatch: expected ${expectedHostname}, got ${finalUrl.hostname}`);
  }
  if (finalUrl.protocol !== "http:" && finalUrl.protocol !== "https:") {
    throw new Error(`redirect to non-http protocol: ${finalUrl.protocol}`);
  }

  // Re-check resolved IP after redirect in case it landed on a different host
  await resolveAndCheckIP(finalUrl.hostname);

  return res.json() as Promise<Record<string, unknown>>;
}

router.post("/heartbeat", async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "url is required" });
    return;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    res.status(400).json({ error: "url is not a valid URL" });
    return;
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    res.status(400).json({ error: "url must use http or https" });
    return;
  }

  const normalizedUrl = url.replace(/\/+$/, "");

  if (isBlacklisted(normalizedUrl)) {
    res.status(403).json({ error: "this site has been blacklisted from ternbook" });
    return;
  }

  // Resolve DNS and reject private IPs before making any request
  try {
    await resolveAndCheckIP(parsedUrl.hostname);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
    return;
  }

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
        res.status(429).json({ error: "rate limited", retryAfterMinutes: retryAfterMins });
        return;
      }
    }
  }

  let data: Record<string, unknown>;

  try {
    data = await fetchSiteData(normalizedUrl);
  } catch (err: any) {
    req.log.warn({ err, url: normalizedUrl }, "failed to fetch ternbook.json");
    res.status(422).json({ error: "could not fetch ternbook.json from that url" });
    return;
  }

  const validationError = validateData(data, normalizedUrl);
  if (validationError) {
    res.status(422).json({ error: validationError });
    return;
  }

  const [currentSite] = await db
    .select({ registeredAt: sitesTable.registeredAt, ial: sitesTable.ial, genesisEpoch: sitesTable.genesisEpoch })
    .from(sitesTable)
    .where(eq(sitesTable.url, normalizedUrl));

  const registeredAt = currentSite?.registeredAt ?? new Date();
  const epoch = currentEpoch();
  const ial     = generateIAL(normalizedUrl, registeredAt, epoch);
  const prevIal = generateIAL(normalizedUrl, registeredAt, epoch - 1);

  const sentIAL = (data.ial as string) ?? null;
  if (sentIAL && sentIAL !== ial && sentIAL !== prevIal) {
    res.status(403).json({ error: "ial code mismatch — your ial may be from a previous epoch, use the prevIal value from your last heartbeat response to update it" });
    return;
  }
  const ialVerified = sentIAL === ial || sentIAL === prevIal;

  // Genesis Lineage Lock: existing site — check if its current IAL collides with a
  // *newer* site's stored IAL. An old site cannot crowd out a newer site's identity.
  if (currentSite !== undefined) {
    const [newerConflict] = await db
      .select({ url: sitesTable.url })
      .from(sitesTable)
      .where(and(
        eq(sitesTable.ial, ial),
        ne(sitesTable.url, normalizedUrl),
        gt(sitesTable.genesisEpoch, currentSite.genesisEpoch),
      ));

    if (newerConflict) {
      res.status(409).json({ error: "Great Scott!" });
      return;
    }
  }

  // New site — check for any IAL collision; Genesis Lineage Lock decides the error message.
  if (currentSite === undefined) {
    const [ialConflict] = await db
      .select({ url: sitesTable.url, genesisEpoch: sitesTable.genesisEpoch })
      .from(sitesTable)
      .where(and(eq(sitesTable.ial, ial), ne(sitesTable.url, normalizedUrl)));

    if (ialConflict) {
      if (ialConflict.genesisEpoch > epoch) {
        // Conflicting site was registered in a future epoch — should be impossible,
        // but if it ever happens the new registrant loses.
        res.status(409).json({ error: "Great Scott!" });
      } else {
        res.status(409).json({ error: "ial code conflict with an existing site" });
      }
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
      ialVerified,
      mapStatus: (data.map as string) ?? null,
      lastSeen: new Date(),
      registeredAt,
      genesisEpoch: epoch,
    })
    .onConflictDoUpdate({
      target: sitesTable.url,
      set: {
        name: data.name as string,
        description: (data.description as string) ?? null,
        tags: (data.tags as string[]) ?? null,
        neighbors: (data.neighbors as string[]) ?? null,
        ial,
        ialVerified,
        mapStatus: (data.map as string) ?? null,
        lastSeen: new Date(),
        // genesisEpoch intentionally excluded — immutable after first registration
      },
    });

  invalidateGraphCache();

  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  fs.appendFileSync(
    path.join(process.cwd(), "../../requesttimes.txt"),
    `crawl requested on ${timestamp} for ${normalizedUrl}\n`
  );

  res.json({ ok: true, url: normalizedUrl, ial, prevIal, epoch, ialVerified });
});

export default router;
