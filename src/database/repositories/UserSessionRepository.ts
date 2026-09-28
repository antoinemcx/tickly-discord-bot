import type { DrizzleDatabase } from "@database/DrizzleDatabase";
import type { UserSession as DbUserSession } from "@database/schema/user.schema";
import type { UserSessionManager } from "@services/todoist/sessions/UserSessionManager";
import { BaseRepository } from "@database/repositories/BaseRepository";
import { userSessionsTable, usersTable } from "@database/schema/user.schema";
import { PersistenceError } from "@services/todoist/errors/PersistenceError";
import { UserSession, UserSessionStatus } from "@services/todoist/sessions/UserSession";
import { eq, inArray, lte } from "drizzle-orm";

/** Database-backed session manager adapter for Todoist OAuth sessions. */
export class UserSessionRepository extends BaseRepository implements UserSessionManager {
  public constructor(
    database: DrizzleDatabase,
    private readonly defaultRetentionDays: number,
  ) {
    super(database);
  }

  public async getSession(userId: string): Promise<UserSession | undefined> {
    try {
      const [session] = await this.db
        .getConnection()
        .select()
        .from(userSessionsTable)
        .where(eq(userSessionsTable.userId, this.toBigIntUserId(userId)))
        .limit(1);

      return session ? this.toSessionModel(session) : undefined;
    } catch (error) {
      throw this.toPersistenceError("Failed to get session by user ID.", error);
    }
  }

  public async getSessionByOAuthState(oauthState: string): Promise<UserSession | undefined> {
    try {
      const [session] = await this.db
        .getConnection()
        .select()
        .from(userSessionsTable)
        .where(eq(userSessionsTable.oauthState, oauthState))
        .limit(1);

      return session ? this.toSessionModel(session) : undefined;
    } catch (error) {
      throw this.toPersistenceError("Failed to get session by OAuth state.", error);
    }
  }

  public async createSession(session: UserSession): Promise<void> {
    try {
      await this.db
        .getConnection()
        .delete(userSessionsTable)
        .where(eq(userSessionsTable.userId, this.toBigIntUserId(session.userId)));

      await this.db
        .getConnection()
        .insert(userSessionsTable)
        .values(this.toSessionEntity(session));
    } catch (error) {
      throw this.toPersistenceError("Failed to create session.", error);
    }
  }

  public async updateSession(session: UserSession): Promise<void> {
    try {
      await this.db
        .getConnection()
        .delete(userSessionsTable)
        .where(eq(userSessionsTable.userId, this.toBigIntUserId(session.userId)));

      await this.db
        .getConnection()
        .insert(userSessionsTable)
        .values(this.toSessionEntity(session));
    } catch (error) {
      throw this.toPersistenceError("Failed to update session.", error);
    }
  }

  public async deleteSession(userId: string): Promise<void> {
    try {
      await this.db
        .getConnection()
        .delete(userSessionsTable)
        .where(eq(userSessionsTable.userId, this.toBigIntUserId(userId)));
    } catch (error) {
      throw this.toPersistenceError("Failed to delete session.", error);
    }
  }

  public async touchSession(userId: string): Promise<void> {
    try {
      await this.db
        .getConnection()
        .update(userSessionsTable)
        .set({ lastUsedAt: new Date() })
        .where(eq(userSessionsTable.userId, this.toBigIntUserId(userId)));
    } catch (error) {
      throw this.toPersistenceError("Failed to touch session.", error);
    }
  }

  public async pruneExpiredSessions(): Promise<void> {
    try {
      await this.pruneExpiredOAuthSessions();
      await this.pruneInactiveSessions();
    } catch (error) {
      throw this.toPersistenceError("Failed to prune sessions.", error);
    }
  }

  /** Deletes pending OAuth sessions whose expires_at deadline has passed. */
  private async pruneExpiredOAuthSessions(): Promise<void> {
    await this.db
      .getConnection()
      .delete(userSessionsTable)
      .where(lte(userSessionsTable.expiresAt, new Date()));
  }

  /**
   * Deletes completed sessions that have been inactive longer than their
   * owner's configured retention period (or the app default).
   */
  private async pruneInactiveSessions(): Promise<void> {
    const sessions = await this.getSessionsWithRetentionPreferences();

    const now = Date.now();
    const toDelete = sessions
      .filter((s) => {
        const retentionMs
          = (s.retentionDays ?? this.defaultRetentionDays) * 24 * 60 * 60 * 1000;
        return s.lastUsedAt.getTime() + retentionMs < now;
      })
      .map(s => s.userId);

    if (toDelete.length > 0) {
      await this.db
        .getConnection()
        .delete(userSessionsTable)
        .where(inArray(userSessionsTable.userId, toDelete));
    }
  }

  private async getSessionsWithRetentionPreferences() {
    return await this.db
      .getConnection()
      .select({
        userId: userSessionsTable.userId,
        lastUsedAt: userSessionsTable.lastUsedAt,
        retentionDays: usersTable.sessionRetentionDays,
      })
      .from(userSessionsTable)
      .innerJoin(usersTable, eq(userSessionsTable.userId, usersTable.id))
      .where(eq(userSessionsTable.status, UserSessionStatus.Completed));
  }

  private toBigIntUserId(userId: string): bigint {
    try {
      return BigInt(userId);
    } catch {
      throw new PersistenceError(`Invalid user ID format: '${userId}'.`);
    }
  }

  private toSessionModel(session: DbUserSession): UserSession {
    return new UserSession(
      session.userId.toString(),
      session.status,
      session.oauthState,
      session.accessToken,
      session.expiresAt,
    );
  }

  private toSessionEntity(session: UserSession): typeof userSessionsTable.$inferInsert {
    return {
      userId: this.toBigIntUserId(session.userId),
      status: session.status,
      oauthState: session.oauthState,
      accessToken: session.accessToken,
      expiresAt: session.expiresAt,
      lastUsedAt: new Date(),
    };
  }

  private toPersistenceError(message: string, error: unknown): PersistenceError {
    if (error instanceof PersistenceError) {
      return error;
    }

    const rootMessage = error instanceof Error ? error.message : String(error);
    return new PersistenceError(`${message} ${rootMessage}`);
  }
}
