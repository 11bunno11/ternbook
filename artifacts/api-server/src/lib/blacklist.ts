import fs from "fs";
import path from "path";

const BLACKLIST_PATH = path.join(process.cwd(), "../../blacklist.json");

interface BlacklistFile {
  blacklisted: string[];
}

export function loadBlacklist(): Set<string> {
  try {
    const raw = JSON.parse(fs.readFileSync(BLACKLIST_PATH, "utf8")) as BlacklistFile;
    return new Set(
      (raw.blacklisted ?? []).map((u) => u.replace(/\/+$/, ""))
    );
  } catch {
    return new Set();
  }
}

export function isBlacklisted(normalizedUrl: string): boolean {
  return loadBlacklist().has(normalizedUrl);
}
