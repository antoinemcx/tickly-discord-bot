import type { UserSession } from "./UserSession";
import type { UserSessionManager } from "./UserSessionManager";

/** In-memory session manager adapter for local tests and playground usage. */
export class InMemoryUserSessionManager implements UserSessionManager {
  private readonly sessionsByUserId = new Map<string, UserSession>();

  public async getSession(userId: string): Promise<UserSession | undefined> {
    return this.sessionsByUserId.get(userId);
  }

  public async getSessionByOAuthState(oauthState: string): Promise<UserSession | undefined> {
    return Array.from(this.sessionsByUserId.values())
      .find(session => session.oauthState === oauthState);
  }

  public async createSession(session: UserSession): Promise<void> {
    this.sessionsByUserId.set(session.userId, session);
  }

  public async updateSession(session: UserSession): Promise<void> {
    this.sessionsByUserId.set(session.userId, session);
  }

  public async deleteSession(userId: string): Promise<void> {
    this.sessionsByUserId.delete(userId);
  }

  /**
   * No-op in the in-memory implementation: last_used_at tracking is handled
   * at the database repository level and is not applicable here.
   */
  public async touchSession(_userId: string): Promise<void> {
    // no-op: last_used_at is a DB-level concern
  }

  public async pruneExpiredSessions(): Promise<void> {
    const now = Date.now();

    for (const [userId, session] of this.sessionsByUserId.entries()) {
      const isExpired = session.expiresAt !== null
        && session.expiresAt.getTime() <= now;

      if (isExpired) {
        this.sessionsByUserId.delete(userId);
      }
    }
  }
}
