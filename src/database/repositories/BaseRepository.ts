import type { DrizzleDatabase } from "@database/DrizzleDatabase";

/**
 * Base repository that provides common database access functionality
 * for all database repositories.
 */
export abstract class BaseRepository {
  protected readonly db: DrizzleDatabase;

  public constructor(database: DrizzleDatabase) {
    this.db = database;
  }
}
