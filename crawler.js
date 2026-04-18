const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function log(emoji, ...args) {
  const time = new Date().toISOString().replace("T", " ").slice(0, 19);
  console.log(`[${time}]`, emoji, ...args);
}

let knownSites = [
  "https://ternbook.neocities.org",
];

let visited = new Set();

async function fetchJSON(baseUrl) {
  try {
    const res = await fetch(baseUrl + "/.well-known/ternbook.json", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) throw new Error("bad response");

    const data = await res.json();
    return data;
  } catch (err) {
    log("❌", "fetch failed:", baseUrl, "-", err.message);
    return null;
  }
}

function validate(data, baseUrl) {
  if (!data) return false;
  if (!data.name || !data.url) return false;
  if (data.url !== baseUrl) return false;
  if (data.tags && data.tags.length > 10) return false;
  if (data.neighbors && data.neighbors.length > 20) return false;
  return true;
}

async function save(data) {
  await pool.query(
    `INSERT INTO sites (url, name, description, tags, neighbors, ial, heartbeat, last_seen)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (url) DO UPDATE SET
       name = EXCLUDED.name,
       description = EXCLUDED.description,
       tags = EXCLUDED.tags,
       neighbors = EXCLUDED.neighbors,
       ial = EXCLUDED.ial,
       heartbeat = EXCLUDED.heartbeat,
       last_seen = EXCLUDED.last_seen`,
    [
      data.url,
      data.name,
      data.description ?? null,
      data.tags ?? null,
      data.neighbors ?? null,
      data.ial ?? null,
      data.heartbeat ? new Date(data.heartbeat) : null,
      new Date(data.lastSeen),
    ]
  );
}

async function crawlSite(url) {
  if (visited.has(url)) return;
  visited.add(url);

  log("🔍", "crawling:", url);

  const data = await fetchJSON(url);

  if (!validate(data, url)) {
    log("⚠️", "invalid or unreachable:", url);
    return;
  }

  data.lastSeen = new Date().toISOString();
  await save(data);
  log("💾", "saved:", url);

  if (data.neighbors) {
    for (let neighbor of data.neighbors) {
      if (!visited.has(neighbor)) {
        log("🔗", "discovered neighbor:", neighbor);
        knownSites.push(neighbor);
      }
    }
  }
}

async function main() {
  log("🚀", "crawler started, seed sites:", knownSites.length);

  let i = 0;
  for (let site of knownSites) {
    i++;
    log("📋", `progress: ${i}/${knownSites.length}`, `| queue: ${knownSites.length - i} remaining`);
    await crawlSite(site);
    await new Promise(r => setTimeout(r, 2000));
  }

  await pool.end();
  log("✅", `done — visited ${visited.size} site(s)`);
}

main();
