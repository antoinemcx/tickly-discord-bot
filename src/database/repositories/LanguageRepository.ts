import type { DrizzleDatabase } from "@database/DrizzleDatabase";
import type { Language } from "@database/schema/user.schema";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { languagesTable } from "@database/schema/user.schema";
import { BaseRepository } from "./BaseRepository";

export class LanguageRepository extends BaseRepository {
  public constructor(database: DrizzleDatabase) {
    super(database);
  }

  /**
   * Retrieves locale codes of stored languages.
   * @returns all the found languages codes.
   */
  public async getLanguageCodes(): Promise<string[]> {
    const languages = await this.db.getConnection()
      .select({ code: languagesTable.code })
      .from(languagesTable);

    return languages.map(lang => lang.code);
  }

  /**
   * Inserts or updates a language definition in the languages table.
   *
   * @param language language to insert or update
   * @param insertExecutor optional insert executor (for transactions)
   */
  public async addLanguage(
    language: Language,
    insertExecutor?: Pick<MySql2Database, "insert">,
  ): Promise<void> {
    const dbExecutor = insertExecutor ?? this.db.getConnection();

    await dbExecutor
      .insert(languagesTable)
      .values(language)
      .onDuplicateKeyUpdate({
        set: {
          code: language.code,
          name: language.name,
        },
      });
  }
}
