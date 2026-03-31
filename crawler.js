const fs = require("fs");

let knownSites = [
  "https://ternbook.neocities.org", // replace with ur test site
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
    console.log("❌ failed:", baseUrl);
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

function save(data) {
  let db = [];

  if (fs.existsSync("db.json")) {
    db = JSON.parse(fs.readFileSync("db.json"));
  }

  // replace existing or add new
  db = db.filter((site) => site.url !== data.url);
  db.push(data);

  fs.writeFileSync("db.json", JSON.stringify(db, null, 2));
}

async function crawlSite(url) {
  if (visited.has(url)) return;
  visited.add(url);

  console.log("🔍 crawling:", url);

  const data = await fetchJSON(url);

  if (!validate(data, url)) {
    console.log("⚠️ invalid:", url);
    return;
  }

  save(data);

  // discover neighbors
  if (data.neighbors) {
    for (let neighbor of data.neighbors) {
      if (!visited.has(neighbor)) {
        knownSites.push(neighbor);
      }
    }
  }
}

async function main() {
  for (let site of knownSites) {
    await crawlSite(site);
  }

  console.log("✅ done");
}

main();
