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

    public async createSession(session: UserSession): Promise<void> {
        this.sessionsByUserId.set(session.userId, session);
    }

    public async updateSession(session: UserSession): Promise<void> {
        this.sessionsByUserId.set(session.userId, session);
    }

    public async deleteSession(userId: string): Promise<void> {
        this.sessionsByUserId.delete(userId);
    }
}
