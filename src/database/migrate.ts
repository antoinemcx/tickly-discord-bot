import { join } from "node:path";
import { exit } from "node:process";
import { displayError, displayInfo, displaySuccess } from "@src/utils/logger";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { DrizzleDatabase } from "./DrizzleDatabase";
import "dotenv/config";

(async () => {
  if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_NAME) {
    displayError(
      "A database environment variable is not set (DB_HOST, DB_USER or DB_NAME).",
    );
    exit(1);
  }

  try {
    const db: DrizzleDatabase = await DrizzleDatabase.connect({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME,
    });

    displayInfo("Starting migration...");

    await migrate(db.getConnection(), {
      migrationsFolder: join(__dirname, "migrations"),
    });

    await db.close();
    displaySuccess("Migration successful...");
  } catch (error) {
    displayError("Migration failed: " + (error as Error).message);
    exit(1);
  }
})();
