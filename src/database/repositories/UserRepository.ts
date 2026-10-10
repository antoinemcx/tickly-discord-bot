import type { DrizzleDatabase } from "@database/DrizzleDatabase";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { Language } from "@database/schema/user.schema";
import type { Locale } from "discord.js";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { languagesTable, usersTable } from "@database/schema/user.schema";
import { eq } from "drizzle-orm";
import { BaseRepository } from "./BaseRepository";

export interface UserPreferences {
  language: Language | undefined;
  sessionRetentionDays: number | null;
}

export class UserRepository extends BaseRepository {
  public constructor(database: DrizzleDatabase) {
    super(database);
  }

  /**
   * Retrieves all preferences for a Discord user in a single query.
   * Returns safe defaults (undefined / null) when the user has no row or
   * no preference set.
   *
   * @param userId Discord user ID
   * @returns an object with the user's language and session retention preference
   */
  public async getUserPreferences(userId: string): Promise<UserPreferences> {
    const [row] = await this.db.getConnection()
      .select({
        languageId: languagesTable.id,
        languageCode: languagesTable.code,
        languageName: languagesTable.name,
        sessionRetentionDays: usersTable.sessionRetentionDays,
      })
      .from(usersTable)
      .leftJoin(languagesTable, eq(usersTable.preferredLanguageId, languagesTable.id))
      .where(eq(usersTable.id, BigInt(userId)))
      .limit(1);

    const language: Language | undefined
      = row?.languageId !== null && row?.languageId !== undefined
        ? { id: row.languageId, code: row.languageCode!, name: row.languageName! }
        : undefined;

    return {
      language,
      sessionRetentionDays: row?.sessionRetentionDays ?? null,
    };
  }

  /**
   * Retrieves the preferred language configured for a Discord user.
   *
   * @param userId Discord user ID
   * @returns the preferred language or undefined when no preference exists
   */
  public async getUserPreferredLanguage(userId: string): Promise<Language | undefined> {
    const [language] = await this.db.getConnection()
      .select({
        id: languagesTable.id,
        code: languagesTable.code,
        name: languagesTable.name,
      })
      .from(usersTable)
      .innerJoin(languagesTable, eq(usersTable.preferredLanguageId, languagesTable.id))
      .where(eq(usersTable.id, BigInt(userId)))
      .limit(1);

    return language;
  }

  /**
   * Sets the preferred language for a Discord user by language ID.
   * Pass `null` to clear the preferred language.
   *
   * @param userId Discord user ID
   * @param languageId language table ID, or null to clear
   * @throws database error if languageId references a non-existent language
   */
  public async setUserPreferredLanguage(
    userId: string, languageId: number | null): Promise<void>;

  /**
   * Sets the preferred language for a Discord user by locale code.
   * Pass `null` to clear the preferred language.
   *
   * @param userId Discord user ID
   * @param locale locale code, or null to clear
   * @throws {Error} when the locale does not match any stored language
   */
  public async setUserPreferredLanguage(
    userId: string, locale: Locale | null): Promise<void>;

  public async setUserPreferredLanguage(
    userId: string,
    localeOrId: Locale | number | null,
  ): Promise<void> {
    if (localeOrId === null || typeof localeOrId === "number") {
      await this.updatePreferredLanguageId(userId, localeOrId);
    } else {
      const [language] = await this.db.getConnection()
        .select({ id: languagesTable.id })
        .from(languagesTable)
        .where(eq(languagesTable.code, localeOrId))
        .limit(1);

      if (!language) {
        throw new Error(`Language not found for locale: ${localeOrId}`);
      }

      await this.updatePreferredLanguageId(userId, language.id);
    }
  }

  private async updatePreferredLanguageId(
    userId: string,
    languageId: number | null,
  ): Promise<void> {
    if (languageId !== null) {
      await this.ensureUserExists(userId);
    }

    await this.db.getConnection()
      .update(usersTable)
      .set({ preferredLanguageId: languageId })
      .where(eq(usersTable.id, BigInt(userId)));
  }

  /**
   * Retrieves the session inactivity retention configured for a Discord user.
   *
   * @param userId Discord user ID
   * @returns the configured retention in days, or null when no preference is set
   */
  public async getUserSessionRetentionDays(userId: string): Promise<number | null> {
    const [user] = await this.db.getConnection()
      .select({ sessionRetentionDays: usersTable.sessionRetentionDays })
      .from(usersTable)
      .where(eq(usersTable.id, BigInt(userId)))
      .limit(1);

    return user?.sessionRetentionDays ?? null;
  }

  /**
   * Sets the session inactivity retention for a Discord user.
   * Pass `null` to clear the preference (default from config will be used).
   *
   * @param userId Discord user ID
   * @param days positive integer number of days, or null to clear
   */
  public async setUserSessionRetentionDays(
    userId: string,
    days: number | null,
  ): Promise<void> {
    if (days !== null) {
      await this.ensureUserExists(userId);
    }

    await this.db.getConnection()
      .update(usersTable)
      .set({ sessionRetentionDays: days })
      .where(eq(usersTable.id, BigInt(userId)));
  }

  /**
   * Ensures a user row exists in the database.
   * @param userId Discord user ID to register
   */
  public async ensureUserExists(userId: string): Promise<void> {
    await this.db.getConnection()
      .insert(usersTable)
      .values({ id: BigInt(userId) })
      .onDuplicateKeyUpdate({ set: { id: BigInt(userId) } });
  }

  /**
   * Deletes a user and its preferences from the database.
   *
   * @param userId Discord user ID
   * @param executor optional executor for transactions
   */
  public async deleteUser(
    userId: string,
    executor?: Pick<MySql2Database, "delete">,
  ): Promise<void> {
    const dbExecutor = executor ?? this.db.getConnection();

    await dbExecutor
      .delete(usersTable)
      .where(eq(usersTable.id, BigInt(userId)));
  }

  /**
   * Deletes all data associated with a user (session and preferences)
   * within a single transaction.
   *
   * @param userId Discord user ID
   * @param repositories repository factory to delete other repositories data
   */
  public async deleteAllUserData(
    userId: string,
    repositories: RepositoryFactory,
  ): Promise<void> {
    await this.db.getConnection().transaction(async (tx) => {
      await repositories.getUserSessionRepository().deleteSession(userId, tx);
      await this.deleteUser(userId, tx);
    });
  }
}
