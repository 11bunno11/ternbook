import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const sitesTable = pgTable("sites", {
  url: text("url").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  tags: text("tags").array(),
  neighbors: text("neighbors").array(),
  nb: text("nb"),
  heartbeat: timestamp("heartbeat", { withTimezone: true }),
  lastSeen: timestamp("last_seen", { withTimezone: true }),
});

export type Site = typeof sitesTable.$inferSelect;
export type InsertSite = typeof sitesTable.$inferInsert;
