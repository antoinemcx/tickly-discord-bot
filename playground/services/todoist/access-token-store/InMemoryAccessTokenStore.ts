import { AccessTokenStore } from "./AccessTokenStore";

/**
 * In-memory token store for local tests and playground usage.
 */
export class InMemoryAccessTokenStore implements AccessTokenStore {
	private readonly tokenByUserId = new Map<string, string>();

	public async getAccessToken(userId: string): Promise<string | undefined> {
		return this.tokenByUserId.get(userId);
	}

	public async setAccessToken(userId: string, accessToken: string): Promise<void> {
		this.tokenByUserId.set(userId, accessToken);
	}
}
