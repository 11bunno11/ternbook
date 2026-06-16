# Ternbook

Ternbook is a web directory made for the modern internet. It is easy to get onto, and has features like Webmaps and instance gossiping.

This page is meant for developers who want to make their own Ternbook instance.
For people who want to add their website to a Ternbook instance, check [here](https://ternbook.neocities.org).

   

<img width="2157" height="1363" alt="IMG_0732" src="https://github.com/user-attachments/assets/9c4ffcc5-c110-4db3-af0e-09c7a7f04b14" />

## Disclaimer

Ternbook is an open-source protocol built for the human, anti-algorithmic web.
In-line with that spirit of transparency: about 98% of the codebase is generated 
using LLM based coding agents (Replit agent) with the remaining 2% consisting of 
human architectural design, testing, and fine-tuning.

As a solo humanities-based programmer, using AI allowed me to create Ternbook with minimal programming knowledge, which allowed me to think on other features Ternbook needed (would've taken ages if I did the coding by myself)

Every single feature was thoroughly reviewed, integrated, and deployed to production 
by a human (me!!!!). The system design is real, the protocol works, and the code is 
fully audited for your self-hosting peace of mind. The Render page is the "proof" 
that it works!!

##  Getting Started!!

This project is optimized to be run on Replit and Render (for now, if you managed to like
run on another service LMK and I'll update the README).

### Prerequisites
Make sure to set .env variables or else Ternbook can't function!

`DATABASE_URL` (needed for storing website info)

`SESSION_SECRET` (this can be random)

`IAL_SECRET` (ditto) 

`PORT` (you can default to `8080`)

`TERNBOOK_ORIGIN` (this is required for gossip to function) 

### Installation (on online platforms)

**Render**
1. Install dependencies:
   ```bash
   pnpm install --frozen-lockfile && pnpm run typecheck:libs && pnpm --filter "@workspace/ternbook" run build && pnpm --filter "@workspace/api-server" run build && mkdir -p artifacts/api-server/dist/public && cp -r artifacts/ternbook/dist/public/* artifacts/api-server/dist/public/
   ```

2. Run the project:
   ```bash
   pnpm --filter "@workspace/api-server" run start
   ```

**For Active development other than render**

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Run the project:
   ```bash
   pnpm run dev:standalone
   ```

**For Devs looking to locally test Prod**
(make sure to install dependencies before doing this!)

1. Compile
   ```bash
   pnpm run build
   ```

2. Run the project
   ```bash
   cd artifacts/api-server
   pnpm run start
   ```

### Installation (on local environments)

> [!NOTE]
> I actually haven't done a local machine deploy yet.
> If anyone has successfully done it, LMK.
> note to self:  remove this notice if done!!!

1. Get the Code

   I recommend git for this because it easy!
   ```bash
   git clone https://github.com/11bunno11/ternbook.git
   ```

2. Install Dependencies

   Navigate into the project folder using your
   terminal and install the required workspace tools:
   ```bash
   cd ternbook
   pnpm install
   ```
      *(Note: The root configuration will block standard npm or yarn execution to ensure strict lockfile safety across environments!)*

3. Spin up the App
   To run the full multi-layered system
   (Express API server + Vite compiler)
   on a single port with instant hot-reloading, run:
   ```bash
   pnpm run dev:standalone
   ```

##  API Endpoints (`/api/*`)

| Method | Path | Purpose |
| :--- | :--- | :--- |
| **GET** | `/api/healthz` | Health check |
| **GET** | `/api/sites` | Paginated site listing with tag filtering |
| **GET** | `/api/tags` | All valid tags (core content, vibe, system) |
| **GET** | `/api/search` | Full-text search with query syntax |
| **GET** | `/api/random` | Random site for discovery ("Wander") |
| **GET** | `/api/map` | Graph nodes + links for D3 visualization |
| **POST** | `/api/heartbeat` | Site registration / renewal |
| **GET** | `/api/gossip/send` | Pull recent-heartbeat bundle (for other instances) |
| **POST** | `/api/gossip/receive` | Accept a heartbeat bundle from a federated instance |

## Contributing
Contributions, bug reports, and feature requests
are completely welcome! I'll prioritize bug reports
and high quality Pull Requests. If you want a feature to be made,
fork the Repo and make the thing you want to have on Ternbook,
and open a PR (some may be rejected). Alternatively, do discussions, and if many agree
on a feature to be implemented, I might make it real.


## Security Concerns
If you found any security issues, contact me [here](mailto:11bunno11@gmail.com?subject=Ternbook%20Security%20Issue&body=Description%20of%20Vulnerability%3A%0A%0A%0ASteps%20to%20Reproduce%20%2F%20PoC%3A%0A%0A%0AThreat%20Impact%3A) and I'll look into it. 

Look at [SECURITY.md](SECURITY.md) for more precise info.

## 📝 License
This project is licensed under the AGPLv3 License - see the LICENSE file for details.
