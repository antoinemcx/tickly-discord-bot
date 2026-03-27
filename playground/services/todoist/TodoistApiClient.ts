import {
	type AddTaskArgs,
	getAuthStateParameter,
	getAuthorizationUrl,
	getAuthToken,
	type Permission,
	TodoistApi,
	type Task,
} from "@doist/todoist-api-typescript";
import { AccessTokenStore } from "./access-token-store/AccessTokenStore";

/**
 * OAuth2 configuration required by the application.
 */
export type TodoistOAuthConfig = {
	clientId: string;
	clientSecret: string;
	permissions?: readonly Permission[];
	stateTtlMs?: number;
	tokenStore: AccessTokenStore;
};

/**
 * Value object returned when creating an OAuth2 authorization request.
 */
export type OAuthAuthorizationRequest = {
	state: string;
	authorizationUrl: string;
};

type OAuthStateRecord = {
	userId?: string;
	expiresAtEpochMs: number;
};

/**
 * Business-oriented facade around the Todoist SDK.
 *
 * This class encapsulates:
 * - OAuth2 flow (authorization URL + code to token exchange),
 * - multi-user token usage through a pluggable token store,
 * - reusable typed business methods (for example, addTask).
 *
 * Composition is intentionally preferred over inheriting TodoistApi because
 * each user has a distinct access token and the SDK client is token-bound.
 */
export class TodoistApiClient {
	private readonly clientId: string;
	private readonly clientSecret: string;
	private readonly permissions: readonly Permission[];
	private readonly stateTtlMs: number;
	private readonly tokenStore: AccessTokenStore;
	private readonly stateStore = new Map<string, OAuthStateRecord>();

	/**
	 * Creates a reusable application-level Todoist client.
	 */
	public constructor(config: TodoistOAuthConfig) {
		this.clientId = config.clientId;
		this.clientSecret = config.clientSecret;
		this.permissions = config.permissions ?? ["data:read_write"];
		this.stateTtlMs = config.stateTtlMs ?? 10 * 60 * 1000;
		this.tokenStore = config.tokenStore;
	}

	/**
	 * Generates an OAuth2 authorization URL and stores a one-time state value.
	 *
	 * The state is kept in memory with a TTL and can be associated with an
	 * internal user id to simplify callback correlation.
	 */
	public createAuthorizationRequest(userId?: string): OAuthAuthorizationRequest {
		this.pruneExpiredStates();

		const state = getAuthStateParameter();
		this.stateStore.set(state, {
			userId,
			expiresAtEpochMs: Date.now() + this.stateTtlMs,
		});

		return {
			state,
			authorizationUrl: getAuthorizationUrl({
				clientId: this.clientId,
				permissions: this.permissions,
				state,
			}),
		};
	}

	/**
	 * Validates and consumes an OAuth2 state value (CSRF protection).
	 *
	 * Returns the internal user id associated with this state, if any.
	 * The state is deleted after successful validation.
	 */
	public consumeState(state: string): string | undefined {
		const record = this.stateStore.get(state);
		if (!record) {
			throw new Error("Invalid OAuth state parameter.");
		}

		if (record.expiresAtEpochMs <= Date.now()) {
			this.stateStore.delete(state);
			throw new Error("Expired OAuth state parameter.");
		}

		this.stateStore.delete(state);
		return record.userId;
	}

	/**
	 * Clears all currently stored OAuth states.
	 * Useful for explicit cleanup in tests or shutdown hooks.
	 */
	public clearPendingStates(): void {
		this.stateStore.clear();
	}

	/**
	 * Exchanges an OAuth2 authorization code for a Todoist access token.
	 * @throws TodoistRequestError if the token exchange fails
	 */
	public async exchangeCodeForAccessToken(code: string): Promise<string> {
		const response = await getAuthToken({
			clientId: this.clientId,
			clientSecret: this.clientSecret,
			code,
		});

		return response.accessToken;
	}

	/**
	 * Saves or replaces a user's Todoist access token in the configured token store.
	 */
	public async registerUserAccessToken(userId: string, accessToken: string): Promise<void> {
		await this.tokenStore.setAccessToken(userId, accessToken);
	}

	/**
	 * Returns true when a token exists for the given user.
	 */
	public async hasUserToken(userId: string): Promise<boolean> {
		const token = await this.tokenStore.getAccessToken(userId);
		return typeof token === "string" && token.length > 0;
	}

	/**
	 * Creates a Todoist SDK API client for a user on demand.
	 *
	 * This intentionally does not cache TodoistApi instances to avoid unbounded
	 * memory growth for low-frequency users.
	 */
	public async getUserApi(userId: string): Promise<TodoistApi> {
		const accessToken = await this.tokenStore.getAccessToken(userId);
		if (!accessToken) {
			throw new Error(`No Todoist access token found for user '${userId}'.`);
		}

		return new TodoistApi(accessToken);
	}

	/**
	 * Creates a Todoist task for the given user.
	 */
	public async addTaskForUser(userId: string, args: AddTaskArgs): Promise<Task> {
		const api = await this.getUserApi(userId);
		return api.addTask(args);
	}

	/**
	 * Removes expired OAuth states from memory.
	 */
	private pruneExpiredStates(): void {
		const now = Date.now();
		for (const [state, record] of this.stateStore) {
			if (record.expiresAtEpochMs <= now) {
				this.stateStore.delete(state);
			}
		}
	}
}
