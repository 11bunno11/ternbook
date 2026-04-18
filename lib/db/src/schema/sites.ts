import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const sitesTable = pgTable("sites", {
  url: text("url").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  tags: text("tags").array(),
  neighbors: text("neighbors").array(),
  ial: text("ial"),
  ialVerified: boolean("ial_verified").default(false).notNull(),
  heartbeat: timestamp("heartbeat", { withTimezone: true }),
  lastSeen: timestamp("last_seen", { withTimezone: true }),
  registeredAt: timestamp("registered_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Site = typeof sitesTable.$inferSelect;
export type InsertSite = typeof sitesTable.$inferInsert;
