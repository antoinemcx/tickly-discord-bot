import type { DbOptions } from "@database/DrizzleDatabase";
import { join } from "node:path";
import { exit } from "node:process";
import { displayError, displayInfo, displaySuccess } from "@src/utils/logger";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { DrizzleDatabase } from "./DrizzleDatabase";
import "dotenv/config";

/**
 * Runs all pending Drizzle migrations against the database of the given
 * configuration.
 *
 * @param config database connection options
 * @throws {Error} if migration fails
 */
export async function runMigrations(config: DbOptions): Promise<void> {
  const db = await DrizzleDatabase.connect(config);

  try {
    displayInfo("Starting migration...");
    await migrate(db.getConnection(), {
      migrationsFolder: join(__dirname, "migrations"),
    });
    displaySuccess("Migration successful.");
  } finally {
    await db.close();
  }
}

/* CLI entry point: `npm run db:migrate` */
if (require.main === module) {
  (async () => {
    if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_NAME) {
      displayError(
        "A database environment variable is not set (DB_HOST, DB_USER or DB_NAME).",
      );
      exit(1);
    }

    const config: DbOptions = {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME,
    };

    try {
      await DrizzleDatabase.ensureDatabaseExists(config);
      await runMigrations(config);
    } catch (error) {
      displayError("Migration failed: " + (error as Error).message);
      exit(1);
    }
  })();
}
