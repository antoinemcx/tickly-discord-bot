import type { DrizzleDatabase } from "@database/DrizzleDatabase";
import type { Language } from "@database/schema/user.schema";
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
}
