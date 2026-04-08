import type { DrizzleDatabase } from "@database/DrizzleDatabase";
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
}
