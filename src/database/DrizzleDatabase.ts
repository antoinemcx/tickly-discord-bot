import type { Language } from "@database/schema/user.schema";
import type { MySql2Database } from "drizzle-orm/mysql2";
import type { RowDataPacket } from "mysql2";
import type { Pool } from "mysql2/promise";
import { LanguageRepository } from "@database/repositories/LanguageRepository";
import { Locale } from "discord.js";
import { getTableName } from "drizzle-orm";
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

  /**
   * Runs startup database checks and seeds base configuration data.
   *
   * @returns a promise that resolves when initialization is complete
   * @throws {Error} if table verification or seeding fails
   */
  public async initializeBaseData(): Promise<void> {
    displayInfo("Verifying database schema tables...");
    await this.assertTablesExist();
    displaySuccess("Required database tables are present.");

    displayInfo("Seeding base configuration data...");
    await this.seedTables();
    displaySuccess("Base configuration data is ready.");
  }

  /**
   * Validates that all required tables for the current schema are present
   * in the active database, and throws otherwise.
   *
   * @returns a promise that resolves when all required tables exist
   * @throws {Error} if one or more required tables are missing
   */
  public async assertTablesExist(): Promise<void> {
    let rows: RowDataPacket[];
    const requiredTables
      = Object.values(schema).map(table => getTableName(table));
    const placeholders = requiredTables.map(() => "?").join(",");

    try {
      [rows] = await this.pool.query<RowDataPacket[]>(
        `SELECT table_name AS tableName
         FROM information_schema.tables
         WHERE table_schema = DATABASE()
         AND table_name IN (${placeholders})`,
        [...requiredTables],
      );
    } catch (error) {
      throw new Error("Failed to verify database schema tables (" + error + ")");
    }
    const existingTables = new Set(rows.map(row => String(row.tableName)));

    if (existingTables.size !== requiredTables.length) {
      throw new Error("Database tables are missing. "
        + "Run 'npm run db:migrate' before starting the app.");
    }
  }

  /**
   * Seeds immutable base configuration data required by the application.
   *
   * @returns a promise that resolves when base data has been upserted
   * @throws {Error} if the seed query fails
   */
  public async seedTables(): Promise<void> {
    const languageRepository = new LanguageRepository(this);
    const seedLanguages: readonly Language[] = [
      { id: 1, code: Locale.EnglishUS, name: "English" },
      { id: 2, code: Locale.French, name: "French" },
    ];

    try {
      await this.connection.transaction(async (tx) => {
        for (const language of seedLanguages) {
          await languageRepository.addLanguage(language, tx);
        }
      });
    } catch (error) {
      throw new Error("Failed to seed base configuration data (" + error + ")");
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
