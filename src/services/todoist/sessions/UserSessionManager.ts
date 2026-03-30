import { UserSession } from "./UserSession";

/**
 * Persistence abstraction for Todoist OAuth user sessions.
 * It acts as an Adapter to support multiple persistence management strategies.
 */
export interface UserSessionManager {
    /**
     * Retrieves a user's session by its application-specific identifier,
     * such as a Discord user ID.
     * 
     * @params userId application-specific user ID to look up for
     * @returns user session for the given userId, or undefined if not found
     */
    getSession(userId: string): Promise<UserSession | undefined>;
    /**
     * Retrieves a session by an OAuth state, which is given by the
     * Todoist API during the OAuth flow.
     * 
     * @params oauthState OAuth state to look up for
     * @returns user session for the given oauthState, or undefined if not found
     */
    getSessionByOAuthState(oauthState: string): Promise<UserSession | undefined>;

    /**
     * Creates a new user session.
     * 
     * If a session already exists for the given user ID, it is replaced
     * by the new session.
     * 
     * @params session user session to create
     * @returns a promise resolving when the session is created
     * @throws {PersistenceError} if an error occurs during session persistence
     */
    createSession(session: UserSession): Promise<void>;
    /**
     * Updates an existing user session, identified by its user ID, by
     * replacing it with the new session.
     * If no session exists for the given user ID, a new session is created.
     * 
     * @params session user session to update
     * @returns a promise resolving when the session is updated
     * @throws {PersistenceError} if the update fails due to persistence errors
     */
    updateSession(session: UserSession): Promise<void>;
    /**
     * Deletes a user's session by user ID.
     * @params userId application-specific user ID of the session to delete
     * @returns a promise resolving when the session is deleted
     * @throws {PersistenceError} if the deletion fails due to persistence errors
     */
    deleteSession(userId: string): Promise<void>;

    /**
     * Removes expired sessions or expired pending OAuth states. 
     * @returns a promise resolving when expired sessions are pruned
     * @throws {PersistenceError} if the pruning operation fails
     *         due to persistence errors
     */
    pruneExpiredSessions(): Promise<void>;
}
