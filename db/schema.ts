// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
export const households = sqliteTable("households", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull().unique(),
  data: text("data").notNull(),
  version: integer("version").notNull().default(0),
});
