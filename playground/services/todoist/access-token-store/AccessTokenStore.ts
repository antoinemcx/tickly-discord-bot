/**
 * Persistence abstraction for per-user Todoist access tokens.
 */
export interface AccessTokenStore {
	getAccessToken(userId: string): Promise<string | undefined>;
	setAccessToken(userId: string, accessToken: string): Promise<void>;
}
