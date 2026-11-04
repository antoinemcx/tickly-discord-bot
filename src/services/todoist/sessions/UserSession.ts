/**
 * Represents a Todoist OAuth user session.
 *
 * When created, a session is in "pending" status and contains the
 * generated OAuth state value for CSRF protection.
 * Once the OAuth flow is completed successfully, the session is updated
 * with the obtained access token, marked as "completed", and its OAuth
 * state is cleared (null).
 */
export class UserSession {
  public constructor(
    public readonly userId: string,
    public status: UserSessionStatus,
    public oauthState: string | null,
    public accessToken: string | null,
    public expiresAt: Date | null,
  ) {}
}

export enum UserSessionStatus {
  Pending = "pending",
  Completed = "completed",
}
