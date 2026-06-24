# Ternbook — Feature Overview & Spec Sheet
<br>
<br>

## What it is
A decentralized web directory and webring for indie/small-web sites. <br>
Sites opt in by publishing a .well-known/ternbook.json file, then sending <br> 
a heartbeat to register. Multiple instances can federate with each other via a gossip protocol. <br>

## API Endpoints (/api/*)
| Method | Path	| Purpose |
| :--- | :--- | :--- |
| **GET** |	`/api/healthz` |	Health check |
| **GET** |	`/api/sites` |	Paginated site listing with tag filtering |
| **GET**	| `/api/tags` |	All valid tags (core content, vibe, system) |
| **GET**	|	`/api/search` |	Full-text search with query syntax |
| **GET**	|	`/api/random` |	Random site for discovery ("Wander") |
| **GET**	|	`/api/map` |	Graph nodes + links for D3 visualization |
| **POST**	|	`/api/heartbeat` |	Site registration / renewal |
| **GET**	|	`/api/gossip/send` |	Pull recent-heartbeat bundle (for other instances) |
| **POST** |	`/api/gossip/receive` |	Accept a heartbeat bundle from a federated instance |

## Heartbeat (POST /api/heartbeat)
Sites call this to register or renew. The server fetches and 
<br>validates /.well-known/ternbook.json from the site before accepting.

## ternbook.json schema:

```json
{
  "name": "My Site",
  "url": "https://mysite.com",
  "description": "optional, max 256 chars",
  "tags": ["blog", "art"],
  "neighbors": ["https://friendsite.com"],
  "ial": "optional-identity-token",
  "map": "in | out | join"
}
```

## Protections on heartbeat:

- DNS resolution + private IP rejection (SSRF guard)
- Rate limit: one heartbeat per site per 12 hours (exceptions.json override)
- IAL (Identity Assurance Layer) token rotation per epoch
- Genesis Lineage Lock prevents token squatting
- Blacklist check → 403

## Database Schema (sites table)

| Column | Type |	Notes |
| :--- | :--- | :--- |
| `url` |	text |	(PK)	Normalized, no trailing slash |
| `name` |	text	|	Max 64 chars |
| `description` |	text	|	Max 256 chars |
| `tags` |	text[]	|	User-chosen, from allowed list |
| `neighbors` |	text[]	|	Outbound links declared by the site |
| `ial` |	text	|	HMAC-SHA256 identity token |
| `ialVerified` |	boolean	|	True if site sent a matching IAL |
| `mapStatus` |	text	|	in/join or out |
| `lastSeen` |	timestamp	|	Last heartbeat or gossip update |
| `registeredAt` |	timestamp	|	Immutable — first registration |
| `genesisEpoch` |	integer	|	Epoch at first registration |
| `sourceInstance` |	text	|	Which federated instance introduced the site |

## Search Syntax (GET `/api/search?q=...`)

| Operator	| Example | Matches | 
| :--- | :--- | :--- |
| Plain |	`pixel art` |	Name, description |
| `tag:` |	`tag:blog` |	Sites with that tag |
| `title:` |	`title:garden` |	Name field only |
| `is:` |	`is:verified` |	IAL-verified sites only |
| `-tag:` |	`-tag:nsfw` |	Removes specified tag from result |

## Frontend Pages
| Route	| Page	| Description |
| :--- | :--- | :--- |
| `/` | Directory |	Card grid with infinite scroll, tag filter dropdowns, search bar |
| `/map` |	Map |	Full-screen D3 force-directed graph — zoomable, draggable, tag-highlight, node search |
| `/random` | 	Wander |	One-click random site opener, optional tag filter |

## Federation (Gossip Protocol)
- Instances declare peers in `gossip.json` (send / receive lists)
- `GET /gossip/send` returns sites active in the last 6 hours
- `POST /gossip/receive` ingests a bundle — only from whitelisted origins
- Blacklisted URLs are silently dropped during gossip ingestion

## Config Files (repo root)
| File| Purpose |
| :--- | :--- | 
| `blacklist.json`	| URLs banned from registering or being gossiped in |
| `exceptions.json`	| URLs exempt from the 12-hour heartbeat rate limit |
| `gossip.json`	| Federation peer lists (send + receive) |
| `requesttimes.txt`	| Append-only log of every heartbeat request |

## Deployment
- **Single process in production** — Express serves the Vite-built frontend as static files + a SPA catch-all, plus all API routes
- **Dev (Replit)** — two separate processes: Express on port 8080, Vite on port 18715
- **Dev (standalone / Render local)** — `dev:standalone` runs Express + Vite middleware on a single port
- **Build:** `pnpm install && NODE_ENV=production pnpm --filter @workspace/api-server run build`
- **Start:** `node --enable-source-maps artifacts/api-server/dist/index.mjs`
- **Required** `env vars: DATABASE_URL, SESSION_SECRET, IAL_SECRET, TERNBOOK_ORIGIN (for gossip)`
