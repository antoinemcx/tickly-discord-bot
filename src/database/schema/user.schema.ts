import { UserSessionStatus } from "@services/todoist/sessions/UserSession";
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
export const languagesTable = mysqlTable("languages", {
  id: int("id").primaryKey(),
  code: varchar("code", { length: 8 }).notNull(),
  name: varchar("name", { length: 20 }).notNull(),
});
export type Language = typeof languagesTable.$inferSelect;

/* User tables */
export const usersTable = mysqlTable("users", {
  id: bigint("id", { mode: "bigint" }).primaryKey(), // Discord user ID
  languageId: int("language_id")
    .notNull()
    .references(() => languagesTable.id)
    .default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export type User = typeof usersTable.$inferSelect;

const userSessionStatusValues = Object.values(UserSessionStatus) as [
  UserSessionStatus,
  ...UserSessionStatus[],
];
export const userSessionsTable = mysqlTable("user_sessions", {
  id: bigint("id", { mode: "bigint" }).autoincrement().primaryKey(),
  userId: bigint("user_id", { mode: "bigint" })
    .notNull()
    .references(() => usersTable.id),
  status: mysqlEnum("status", userSessionStatusValues).notNull(),
  oauthState: varchar("oauth_state", { length: 255 }).notNull().unique(),
  accessToken: text("access_token"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
});

export type UserSession = typeof userSessionsTable.$inferSelect;
