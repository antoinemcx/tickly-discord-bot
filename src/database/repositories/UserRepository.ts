import type { DrizzleDatabase } from "@database/DrizzleDatabase";
import type { Language } from "@database/schema/user.schema";
import type { Locale } from "discord.js";
import { languagesTable, usersTable } from "@database/schema/user.schema";
import { eq } from "drizzle-orm";
import { BaseRepository } from "./BaseRepository";

export class UserRepository extends BaseRepository {
  public constructor(database: DrizzleDatabase) {
    super(database);
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

  private async ensureUserExists(userId: string): Promise<void> {
    await this.db.getConnection()
      .insert(usersTable)
      .values({ id: BigInt(userId) })
      .onDuplicateKeyUpdate({ set: { id: BigInt(userId) } });
  }
}
