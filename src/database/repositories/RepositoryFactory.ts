import type { DrizzleDatabase } from "@database/DrizzleDatabase";
import { LanguageRepository } from "@database/repositories/LanguageRepository";
import { UserSessionRepository } from "@database/repositories/UserSessionRepository";

/**
 * Central access point for all repository instances used by Tickly.
 * Repositories are created lazily and cached for the lifetime of the app.
 */
export class RepositoryFactory {
  private languageRepository?: LanguageRepository;
  private userSessionRepository?: UserSessionRepository;

  public constructor(private readonly database: DrizzleDatabase) {}

  /** @returns the language repository instance. */
  public getLanguageRepository(): LanguageRepository {
    this.languageRepository ??= new LanguageRepository(this.database);
    return this.languageRepository;
  }

  /** @returns the user session repository instance. */
  public getUserSessionRepository(): UserSessionRepository {
    this.userSessionRepository ??= new UserSessionRepository(this.database);
    return this.userSessionRepository;
  }
}
