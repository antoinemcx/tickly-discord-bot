import type { Language } from "@database/schema/user.schema";
import type { MySql2Database } from "drizzle-orm/mysql2";
import type { RowDataPacket } from "mysql2";
import type { Connection, Pool } from "mysql2/promise";
import { LanguageRepository } from "@database/repositories/LanguageRepository";
import { Locale } from "discord.js";
import { getTableName } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createConnection, createPool } from "mysql2/promise";
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
   * Ensures the target database exists, creating it if necessary.
   * Connects to the server without specifying a database, runs
   * `CREATE DATABASE IF NOT EXISTS`, then closes the connection.
   *
   * @param config database configuration
   * @throws {Error} if the database cannot be created
   */
  public static async ensureDatabaseExists(config: DbOptions): Promise<void> {
    const dbName = config.database.trim();
    if (!dbName) {
      throw new Error("Database name is required.");
    }

    let connection: Connection | undefined;
    try {
      connection = await createConnection({
        host: config.host.trim(),
        user: config.user.trim(),
        password: config.password,
      });
      await connection.query(
        `CREATE DATABASE IF NOT EXISTS \`${dbName}\``,
      );
      displaySuccess(`Database "${dbName}" is ready.`);
    } catch (error) {
      throw new Error("Failed to ensure database exists (" + error + ")");
    } finally {
      await connection?.end();
    }
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
        supportBigNumbers: true,
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
    displaySuccess("Base configuration data is ready.\n");
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
        + "Ensure migrations have completed successfully before starting the app.");
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
      { id: 3, code: Locale.Polish, name: "Polish" },
      { id: 4, code: Locale.SpanishES, name: "Spanish" },
      { id: 5, code: Locale.German, name: "German" },
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
