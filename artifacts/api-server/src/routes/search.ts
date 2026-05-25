import { Router, type IRouter } from "express";
import { fetchEnrichedSites, type EnrichedSite } from "../lib/enrichSites.js";

const router: IRouter = Router();

type Field = "tag" | "is" | "desc" | "title" | "any";

interface Term {
  field: Field;
  values: string[];
  negate: boolean;
}

interface ParsedQuery {
  orMode: boolean;
  terms: Term[];
}

function parseQuery(raw: string): ParsedQuery {
  const orMode = /\bOR\b/.test(raw);
  const cleaned = raw.replace(/\bOR\b/g, " ").trim();
  const tokens = cleaned.match(/(?:-?(?:tag|is|desc|title):\S+|\S+)/gi) ?? [];

  const terms: Term[] = [];

  for (const token of tokens) {
    const fieldMatch = token.match(/^(-?)(tag|is|desc|title):(.+)$/i);
    if (fieldMatch) {
      const negate = fieldMatch[1] === "-";
      const field = fieldMatch[2].toLowerCase() as Field;
      const values = fieldMatch[3].split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
      if (values.length > 0) terms.push({ field, values, negate });
    } else {
      const word = token.toLowerCase();
      if (word) terms.push({ field: "any", values: [word], negate: false });
    }
  }

  return { orMode, terms };
}

function termMatches(term: Term, site: EnrichedSite): boolean {
  const { field, values } = term;

  const check = (v: string): boolean => {
    switch (field) {
      case "tag":
        return (site.tags ?? []).includes(v);
      case "is":
        return site.systemTags.includes(v);
      case "desc":
        return (site.description ?? "").toLowerCase().includes(v);
      case "title":
        return site.name.toLowerCase().includes(v);
      case "any": {
        const haystack = [
          site.name,
          site.description ?? "",
          site.url,
          ...(site.tags ?? []),
          ...site.systemTags,
        ].join(" ").toLowerCase();
        return haystack.includes(v);
      }
    }
  };

  // all values within a term must match (AND within a field)
  return values.every(check);
}

function matchesSite(site: EnrichedSite, parsed: ParsedQuery): boolean {
  const { orMode, terms } = parsed;

  const positive = terms.filter((t) => !t.negate);
  const negative = terms.filter((t) => t.negate);

  // negations always exclude
  for (const term of negative) {
    if (termMatches(term, site)) return false;
  }

  if (positive.length === 0) return true;

  return orMode
    ? positive.some((t) => termMatches(t, site))
    : positive.every((t) => termMatches(t, site));
}

router.get("/search", async (req, res) => {
  const raw = typeof req.query.q === "string" ? req.query.q.trim() : "";

  if (!raw) {
    res.status(400).json({ error: "q is required" });
    return;
  }

  const parsed = parseQuery(raw);
  const sites = await fetchEnrichedSites();
  const results = sites.filter((s) => matchesSite(s, parsed));

  res.json({ query: parsed, count: results.length, results });
});

export default router;
