import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sitesTable } from "@workspace/db/schema";

const router: IRouter = Router();

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

  let data: Record<string, unknown>;

  try {
    data = await fetchSiteData(url);
  } catch (err) {
    req.log.warn({ err, url }, "failed to fetch ternbook.json");
    res.status(422).json({ error: "could not fetch ternbook.json from that url" });
    return;
  }

  if (!validate(data, url)) {
    res.status(422).json({ error: "ternbook.json is invalid" });
    return;
  }

  await db
    .insert(sitesTable)
    .values({
      url: data.url as string,
      name: data.name as string,
      description: (data.description as string) ?? null,
      tags: (data.tags as string[]) ?? null,
      neighbors: (data.neighbors as string[]) ?? null,
      nb: (data.nb as string) ?? null,
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
        nb: (data.nb as string) ?? null,
        heartbeat: data.heartbeat ? new Date(data.heartbeat as string) : null,
        lastSeen: new Date(),
      },
    });

  res.json({ ok: true, url });
});

export default router;
