import type { DrizzleDatabase } from "@database/DrizzleDatabase";
import type { UserSessionManager } from "@services/todoist/sessions/UserSessionManager";
import { BaseRepository } from "@database/repositories/BaseRepository";
import { userSessionsTable } from "@database/schema/user.schema";
import { PersistenceError } from "@services/todoist/errors/PersistenceError";
import { UserSession } from "@services/todoist/sessions/UserSession";
import { eq, lte } from "drizzle-orm";

/** Database-backed session manager adapter for Todoist OAuth sessions. */
export class UserSessionRepository extends BaseRepository implements UserSessionManager {
  public constructor(database: DrizzleDatabase) {
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

      return session ? this.toDomainSession(session) : undefined;
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

      return session ? this.toDomainSession(session) : undefined;
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
        .values(this.toEntitySession(session));
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
        .values(this.toEntitySession(session));
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

  public async pruneExpiredSessions(): Promise<void> {
    try {
      await this.db
        .getConnection()
        .delete(userSessionsTable)
        .where(lte(userSessionsTable.expiresAt, new Date()));
    } catch (error) {
      throw this.toPersistenceError("Failed to prune expired sessions.", error);
    }
  }

  private toBigIntUserId(userId: string): bigint {
    try {
      return BigInt(userId);
    } catch {
      throw new PersistenceError(`Invalid user ID format: '${userId}'.`);
    }
  }

  private toDomainSession(session: typeof userSessionsTable.$inferSelect): UserSession {
    return new UserSession(
      session.userId.toString(),
      session.status as UserSession["status"],
      session.oauthState,
      session.accessToken,
      session.expiresAt,
    );
  }

  private toEntitySession(session: UserSession): typeof userSessionsTable.$inferInsert {
    return {
      userId: this.toBigIntUserId(session.userId),
      status: session.status,
      oauthState: session.oauthState,
      accessToken: session.accessToken,
      expiresAt: session.expiresAt,
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
