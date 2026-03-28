import { UserSession } from "./UserSession";
import { UserSessionManager } from "./UserSessionManager";

/**
 * In-memory session manager adapter for local tests and playground usage.
 */
export class InMemoryUserSessionManager implements UserSessionManager {
    private readonly sessionsByUserId = new Map<string, UserSession>();

    public async getSession(userId: string): Promise<UserSession | undefined> {
        return this.sessionsByUserId.get(userId);
    }

    public async getSessionByOAuthState(oauthState: string): Promise<UserSession | undefined> {
        for (const session of this.sessionsByUserId.values()) {
            if (session.oauthState === oauthState) {
                return session;
            }
        }

        return undefined;
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

    public async pruneExpiredStates(): Promise<void> {
        const now = Date.now();

        for (const [userId, session] of this.sessionsByUserId.entries()) {
            const isExpired = session.expiresAt !== null && session.expiresAt.getTime() <= now;

            if (isExpired) {
                this.sessionsByUserId.delete(userId);
            }
        }
    }
}
