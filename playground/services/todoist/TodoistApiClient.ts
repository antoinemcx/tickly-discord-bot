import {
	type AddTaskArgs,
	getAuthStateParameter,
	getAuthorizationUrl,
	getAuthToken,
	type Permission,
	TodoistApi,
	type Task,
} from "@doist/todoist-api-typescript";
import { UserSession, UserSessionStatus } from "./sessions/UserSession";
import { UserSessionManager } from "./sessions/UserSessionManager";

/**
 * OAuth2 configuration required by the application.
 */
export type TodoistOAuthConfig = {
	clientId: string;
	clientSecret: string;
	permissions?: readonly Permission[];
	stateTtlMs?: number;
	sessionManager: UserSessionManager;
};

/**
 * Value object returned when creating an OAuth2 authorization request.
 */
export type OAuthAuthorizationRequest = {
	state: string;
	authorizationUrl: string;
};

/**
 * Business-oriented facade around the Todoist SDK.
 *
 * This class encapsulates:
 * - OAuth2 flow (authorization URL + code to token exchange),
 * - multi-user session usage through a pluggable session manager,
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
	private readonly sessionManager: UserSessionManager;

	/**
	 * Creates a reusable application-level Todoist client.
	 */
	public constructor(config: TodoistOAuthConfig) {
		this.clientId = config.clientId;
		this.clientSecret = config.clientSecret;
		this.permissions = config.permissions ?? ["data:read_write"];
		this.stateTtlMs = config.stateTtlMs ?? 10 * 60 * 1000;
		this.sessionManager = config.sessionManager;
	}

	/**
	 * Generates an OAuth2 authorization URL and stores a one-time state value.
	 */
	public async createAuthorizationRequest(userId: string): Promise<OAuthAuthorizationRequest> {
		const state = getAuthStateParameter();
		const existingSession = await this.sessionManager.getSession(userId);
		const expiresAt = new Date(Date.now() + this.stateTtlMs);

		if (!existingSession) {
			await this.sessionManager.createSession(
				new UserSession(
					userId,
					UserSessionStatus.Pending,
					state,
					null,
					expiresAt,
				),
			);
		} else {
			existingSession.status = UserSessionStatus.Pending;
			existingSession.oauthState = state;
			existingSession.accessToken = null;
			existingSession.expiresAt = expiresAt;
			await this.sessionManager.updateSession(existingSession);
		}

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
	 */
	public async consumeState(userId: string, state: string): Promise<void> {
		const session = await this.sessionManager.getSession(userId);
		if (!session) {
			throw new Error("No OAuth session found for this user.");
		}

		if (session.oauthState !== state) {
			throw new Error("Invalid OAuth state parameter.");
		}

		if (session.expiresAt && session.expiresAt.getTime() <= Date.now()) {
			await this.sessionManager.deleteSession(userId);
			throw new Error("Expired OAuth state parameter.");
		}

		// Force one-time state usage by expiring it right after successful validation.
		session.expiresAt = new Date(0);
		await this.sessionManager.updateSession(session);
	}

	/**
	 * Clears the stored session for a specific user.
	 */
	public async clearUserSession(userId: string): Promise<void> {
		await this.sessionManager.deleteSession(userId);
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
	 * Saves or replaces a user's Todoist access token in the configured session manager.
	 */
	public async registerUserAccessToken(userId: string, accessToken: string): Promise<void> {
		const session = await this.sessionManager.getSession(userId);

		if (!session) {
			await this.sessionManager.createSession(
				new UserSession(
					userId,
					UserSessionStatus.Completed,
					"",
					accessToken,
					null,
				),
			);
			return;
		}

		session.status = UserSessionStatus.Completed;
		session.accessToken = accessToken;
		session.expiresAt = null;
		await this.sessionManager.updateSession(session);
	}

	/**
	 * Returns true when a token exists for the given user.
	 */
	public async hasUserToken(userId: string): Promise<boolean> {
		const token = (await this.sessionManager.getSession(userId))?.accessToken;
		return typeof token === "string" && token.length > 0;
	}

	/**
	 * Creates a Todoist SDK API client for a user on demand.
	 *
	 * This intentionally does not cache TodoistApi instances to avoid unbounded
	 * memory growth for low-frequency users.
	 */
	public async getUserApi(userId: string): Promise<TodoistApi> {
		const accessToken = (await this.sessionManager.getSession(userId))?.accessToken;
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

}
