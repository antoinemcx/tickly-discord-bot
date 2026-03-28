import { UserSession } from "./UserSession";

/** Persistence abstraction for Todoist OAuth user sessions. */
export interface UserSessionManager {
    /** Retrieves a user's session, or undefined if not found. */
    getSession(userId: string): Promise<UserSession | undefined>;
    /** Retrieves a session by OAuth state, or undefined if not found. */
    getSessionByOAuthState(oauthState: string): Promise<UserSession | undefined>;
    /** Creates a new user session. */
    createSession(session: UserSession): Promise<void>;
    /** Updates an existing user session. */
    updateSession(session: UserSession): Promise<void>;
    /** Deletes a user's session. */
    deleteSession(userId: string): Promise<void>;
    /** Removes expired sessions or expired pending OAuth states. */
    pruneExpiredStates(): Promise<void>;
}
