import type { UserSession } from "./UserSession";

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
   * Records that a session was just used, resetting its inactivity
   * timer. Should be called whenever a user's access token is retrieved
   * for active use.
   *
   * @params userId user ID of the session to touch
   * @returns a promise resolving when the session is updated
   * @throws {PersistenceError} if the update fails due to persistence errors
   */
  touchSession(userId: string): Promise<void>;

  /**
   * Removes expired OAuth pending sessions and inactive completed sessions
   * that have exceeded their configured retention period.
   *
   * @returns a promise resolving when expired/inactive sessions are pruned
   * @throws {PersistenceError} if the pruning operation fails
   *         due to persistence errors
   */
  pruneExpiredSessions(): Promise<void>;
}
