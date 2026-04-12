import { UserSessionStatus } from "@services/todoist/sessions/UserSession";
import { Locale } from "discord.js";
import {
  bigint,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/* Configuration tables */
const availableLocales
  = mysqlEnum("code", Object.values(Locale) as [ Locale, ...Locale[] ]);
export const languagesTable = mysqlTable("languages", {
  id: int("id").primaryKey(),
  code: availableLocales.notNull(),
  name: varchar("name", { length: 20 }).notNull(),
});
export type Language = typeof languagesTable.$inferSelect;

/* User tables */
export const usersTable = mysqlTable("users", {
  id: bigint("id", { mode: "bigint" }).primaryKey(), // Discord user ID
  preferredLanguageId: int("preferred_language_id")
    .references(() => languagesTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export type User = typeof usersTable.$inferSelect;

const userSessionStatus
  = mysqlEnum("status", Object.values(UserSessionStatus) as [
    UserSessionStatus,
    ...UserSessionStatus[],
  ]);
export const userSessionsTable = mysqlTable("user_sessions", {
  id: bigint("id", { mode: "bigint" }).autoincrement().primaryKey(),
  userId: bigint("user_id", { mode: "bigint" })
    .notNull()
    .references(() => usersTable.id),
  status: userSessionStatus.notNull(),
  oauthState: varchar("oauth_state", { length: 255 }).notNull().unique(),
  accessToken: text("access_token"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
});

export type UserSession = typeof userSessionsTable.$inferSelect;
