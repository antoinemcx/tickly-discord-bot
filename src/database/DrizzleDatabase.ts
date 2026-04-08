import type { MySql2Database } from "drizzle-orm/mysql2";
import type { Pool } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
import { displayInfo, displaySuccess } from "../utils/logger";
import * as schema from "./schema";

/** Options to create a database pool */
export interface DbOptions {
  host: string;
  user: string;
  password: string;
  database: string;
}

/**
 * Singleton-like MySQL database connection that uses Drizzle ORM
 * for type-safe queries.
 */
export class DrizzleDatabase {
  private readonly pool: Pool;
  private readonly connection: MySql2Database<typeof schema>;

  /** Connects to the database with a pool. */
  private constructor(pool: Pool) {
    this.pool = pool;
    this.connection = drizzle(this.pool, { schema, mode: "default" });
  }

  /**
   * Connects to the database for the drizzle connection.
   *
   * @param config database configuration
   * @returns the created Database instance
   */
  public static async connect(config: DbOptions): Promise<DrizzleDatabase> {
    if (!config.host.trim() || !config.user.trim() || !config.database.trim()) {
      throw new Error("Database configuration is incomplete.");
    }
    console.log("");
    displayInfo("Connecting to the database...");

    try {
      const pool: Pool = createPool({
        host: config.host.trim(),
        user: config.user.trim(),
        password: config.password,
        database: config.database.trim(),
      });
      await pool.getConnection(); // connection test

      const db: DrizzleDatabase = new DrizzleDatabase(pool);
      displaySuccess("Database connection is successful 🗃️\n");
      return db;
    } catch (error) {
      throw new Error("Database connection failed (" + error + ")");
    }
  }

  /** Closes the database connection pool. */
  public async close(): Promise<void> {
    if (!this.pool) {
      throw new Error("The database has no connection pool.");
    }

    await this.pool.end();
    displaySuccess("Database connection pool closed.");
  }

  /** @returns the drizzle database connection. */
  public getConnection(): MySql2Database<typeof schema> {
    return this.connection;
  }
}
