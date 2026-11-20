import fs from "fs";
import path from "path";

export type DurationUnit = "hours" | "days" | "months" | "years";
export type DurationSetting = [string, DurationUnit];

export interface TernbookConfig {
  InactivityGhost: DurationSetting;
  InactivityDelete: DurationSetting;
  UnverifiedHide: DurationSetting;
  PingLog: "Enable" | "Disable";
}

const CONFIG_PATH = path.join(process.cwd(), "../../ternbook.config.json");
const VALID_UNITS = new Set<DurationUnit>(["hours", "days", "months", "years"]);

function parseDuration(value: unknown, name: string): DurationSetting {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error(`ternbook.config.json: ${name} must be [amount, unit]`);
  }

  const [rawAmount, rawUnit] = value;
  if (typeof rawAmount !== "string" || !/^\d+$/.test(rawAmount)) {
    throw new Error(`ternbook.config.json: ${name} amount must be a positive integer string`);
  }

  const amount = Number(rawAmount);
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 10_000) {
    throw new Error(`ternbook.config.json: ${name} amount must be between 1 and 10000`);
  }

  if (typeof rawUnit !== "string" || !VALID_UNITS.has(rawUnit as DurationUnit)) {
    throw new Error(`ternbook.config.json: ${name} unit must be hours, days, months, or years`);
  }

  return [String(amount), rawUnit as DurationUnit];
}

function loadConfig(): TernbookConfig {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch (error) {
    throw new Error(`Could not read ${CONFIG_PATH}: ${String(error)}`);
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("ternbook.config.json must contain a JSON object");
  }

  const config = raw as Record<string, unknown>;
  if (config.PingLog !== "Enable" && config.PingLog !== "Disable") {
    throw new Error('ternbook.config.json: PingLog must be "Enable" or "Disable"');
  }

  return {
    InactivityGhost: parseDuration(config.InactivityGhost, "InactivityGhost"),
    InactivityDelete: parseDuration(config.InactivityDelete, "InactivityDelete"),
    UnverifiedHide: parseDuration(config.UnverifiedHide, "UnverifiedHide"),
    PingLog: config.PingLog,
  };
}

export const TERNBOOK_CONFIG = loadConfig();

export function hasDurationElapsed(
  start: Date,
  [rawAmount, unit]: DurationSetting,
  now: Date,
): boolean {
  const amount = Number(rawAmount);
  if (unit === "hours") {
    return now.getTime() >= start.getTime() + amount * 60 * 60 * 1000;
  }
  if (unit === "days") {
    const expiry = new Date(start);
    expiry.setUTCDate(expiry.getUTCDate() + amount);
    return now.getTime() >= expiry.getTime();
  }

  const monthsToAdd = unit === "years" ? amount * 12 : amount;
  const monthIndex = start.getUTCFullYear() * 12 + start.getUTCMonth() + monthsToAdd;
  const targetYear = Math.floor(monthIndex / 12);
  const targetMonth = monthIndex % 12;
  const targetDay = Math.min(
    start.getUTCDate(),
    new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate(),
  );

  const expiry = new Date(start);
  expiry.setUTCDate(1);
  expiry.setUTCFullYear(targetYear);
  expiry.setUTCMonth(targetMonth);
  expiry.setUTCDate(targetDay);
  return now.getTime() >= expiry.getTime();
}
