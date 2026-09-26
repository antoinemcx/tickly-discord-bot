import type { AddTaskArgs, Permission, QuickAddTaskArgs, Task } from "@doist/todoist-api-typescript";
import type { UserSessionManager } from "../../services/todoist/sessions/UserSessionManager";
import {
  getAuthorizationUrl,
  getAuthStateParameter,
  getAuthToken,
  TodoistApi,
} from "@doist/todoist-api-typescript";
import { UserSession, UserSessionStatus } from "../../services/todoist/sessions/UserSession";
import { OAuthError } from "./errors/OAuthError";

/** Options for configuring the Todoist processes. */
export interface TodoistClientOptions {
  permissions?: readonly Permission[];
  oauthStateLifetimeMs?: number;
}

/** Available due date selection options for quick task creation. */
export enum DueStringSelectionOptions {
  Today = "today",
  Tomorrow = "tomorrow",
  NextMonday = "next_monday",
  NextWeek = "next_week",
  NextMonth = "next_month",
}

/** AddTaskArgs without any due-date or due-string related fields. */
export type AddTaskArgsWithoutDates
  = Omit<AddTaskArgs, "dueString" | "dueDate" | "dueDatetime" | "dueLang">;

/**
 * Wrapper around the Todoist SDK that handles:
 * - OAuth2 flow (authorization URL generation, callback validation,
 *   token exchange and session creation)
 * - Multi-user sessions
 * - Task management operations
 *
 * Composition is intentionally preferred over inheriting TodoistApi because
 * each user has a distinct access token and the SDK client is token-bound.
 */
export class TodoistApiClient {
  public static readonly DEFAULT_PERMISSIONS: readonly Permission[]
    = ["data:read_write"];

  public static readonly DEFAULT_OAUTH_STATE_LIFETIME_MS
    = 15 * 60 * 1000; // 15 minutes

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly permissions: readonly Permission[];
  private readonly oauthStateLifetimeMs: number;
  private readonly sessionManager: UserSessionManager;

  /**
   * Creates a reusable application-level Todoist client.
   *
   * @param clientId the Todoist API client ID
   * @param clientSecret the Todoist API client secret
   * @param sessionManager the session manager to use for managing user sessions
   * @param options the options for configuring the Todoist client, which
   *   includes Todoist permissions of the client and the lifetime
   *   of the OAuth state values (valid sessions don't expire)
   */
  public constructor(
    clientId: string,
    clientSecret: string,
    sessionManager: UserSessionManager,
    options?: TodoistClientOptions,
  ) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.permissions = options?.permissions
      ?? TodoistApiClient.DEFAULT_PERMISSIONS;
    this.oauthStateLifetimeMs = options?.oauthStateLifetimeMs
      ?? TodoistApiClient.DEFAULT_OAUTH_STATE_LIFETIME_MS;
    this.sessionManager = sessionManager;
  }

  /**
   * Retrieves a user's session by their application-specific user ID.
   * @param userId application-specific user ID to look up for
   * @returns user session for the given id, or undefined if not found
   */
  public async getSessionByUserId(userId: string): Promise<UserSession | undefined> {
    return this.sessionManager.getSession(userId);
  }

  /**
   * Returns a user's session matching the given OAuth state.
   * This is used to validate the OAuth callback.
   *
   * @params state OAuth state to look up for
   * @returns user session matching the given state, or undefined if not found
   */
  public async getSessionByOAuthState(state: string): Promise<UserSession | undefined> {
    return this.sessionManager.getSessionByOAuthState(state);
  }

  /**
   * Clears the stored session for a specific user.
   *
   * @params userId ID of the user whose session should be deleted
   * @returns a promise resolving when the session is cleared
   * @throws {PersistenceError} if session deletion fails
   */
  public async clearUserSession(userId: string): Promise<void> {
    await this.sessionManager.deleteSession(userId);
  }

  /**
   * Removes expired sessions via the configured session manager.
   *
   * @returns a promise resolving when the expired sessions are cleared,
   *   or if no expired sessions were found
   * @throws {PersistenceError} if session deletion fails
   */
  public async pruneExpiredSessions(): Promise<void> {
    await this.sessionManager.pruneExpiredSessions();
  }

  /**
   * Generates an OAuth2 authorization URL for the specified user ID
   * and stores a one-time state value to recognize the user and validate
   * the OAuth2 callback later on.
   *
   * If the user already has an existing session, it is replaced by a new
   * session with pending status and the new OAuth state.
   *
   * When a locale is provided it is appended to the state parameter in the
   * authorization URL (format: `csrfState|locale`) so the callback route can
   * render result pages in the user's language.
   *
   * @param userId ID of the user to create the authorization URL for
   * @param locale optional locale code to embed in the authorization URL state (e.g. "fr")
   * @returns the full URL to redirect the user to for OAuth2 authorization
   * @throws {PersistenceError} if session persistence fails
   */
  public async createOAuthAuthorizationUrl(userId: string, locale?: string): Promise<string> {
    const csrfState = getAuthStateParameter();
    const existingSession = await this.sessionManager.getSession(userId);
    const expiresAt = new Date(Date.now() + this.oauthStateLifetimeMs);

    const pendingSession = new UserSession(
      userId,
      UserSessionStatus.Pending,
      csrfState,
      null,
      expiresAt,
    );

    if (existingSession) {
      await this.sessionManager.updateSession(pendingSession);
    } else {
      await this.sessionManager.createSession(pendingSession);
    }

    return getAuthorizationUrl({
      clientId: this.clientId,
      permissions: this.permissions,
      state: locale ? `${csrfState}|${locale}` : csrfState,
    });
  }

  /**
   * Exchanges an OAuth2 authorization code for a Todoist access token.
   * @throws {TodoistRequestError} if the token exchange fails
   */
  public async exchangeOAuthCodeForAccessToken(code: string): Promise<string> {
    const response = await getAuthToken({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      code,
    });

    return response.accessToken;
  }

  /**
   * Saves or replaces a user's Todoist access token in the configured
   * session manager.
   *
   * @params userId ID of the user to save the access token for
   * @params accessToken the access token to save in the user session
   * @returns a promise resolving when the token is saved
   * @throws {PersistenceError} if user session creation or update fails
   */
  public async registerUserAccessToken(userId: string, accessToken: string): Promise<void> {
    const session = await this.getSessionByUserId(userId);
    const updatedSession = new UserSession(
      userId,
      UserSessionStatus.Completed,
      "",
      accessToken,
      null,
    );

    if (session) {
      await this.sessionManager.updateSession(updatedSession);
    } else {
      await this.sessionManager.createSession(updatedSession);
    }
  }

  /**
   * Creates a Todoist SDK API client for a user, whether an API client
   * was previously created or not.
   *
   * @throws {OAuthError} if no valid access token is found for the user
   */
  public async getUserApi(userId: string): Promise<TodoistApi> {
    const accessToken = await this.getUserAccessToken(userId);
    if (!accessToken) {
      throw new OAuthError("No Todoist access token found for user '"
        + userId
        + "'. He has never completed the OAuth flow or his session has expired.");
    }

    return new TodoistApi(accessToken);
  }

  /**
   * Retrieves a user's access token from the session manager.
   * @params userId ID of the user to retrieve the access token for
   * @returns the access token for the given user, or undefined if none exists.
   */
  private async getUserAccessToken(userId: string): Promise<string | undefined> {
    // TODO fetch access token from Redis cache first
    const token = (await this.getSessionByUserId(userId))?.accessToken;
    return token && token.length > 0 ? token : undefined;
  }

  /**
   * Creates a Todoist task for the given user.
   * @param userId ID of the user to create the task for
   * @param args the arguments for creating the task
   * @param api optional pre-fetched TodoistApi instance
   * @returns the created task
   * @throws {OAuthError} if no valid access token is found for the user
   * @throws {TodoistRequestError} if the API request fails
   */
  public async addTask(userId: string, args: AddTaskArgs, api?: TodoistApi): Promise<Task> {
    const client = api ?? await this.getUserApi(userId);
    return client.addTask(args);
  }

  /**
   * Creates a Todoist task for the given user from a natural language string.
   * @param userId ID of the user to create the task for
   * @param args the arguments for creating the task, excluding the content string
   * @param api optional pre-fetched TodoistApi instance
   * @returns the created task
   * @throws {OAuthError} if no valid access token is found for the user
   * @throws {TodoistRequestError} if the API request fails
   */
  public async quickAddTask(
    userId: string,
    args: QuickAddTaskArgs,
    api?: TodoistApi,
  ): Promise<Task> {
    const client = api ?? await this.getUserApi(userId);
    return client.quickAddTask(args);
  }

  /**
   * Creates a Todoist task with a due date derived from a selection option.
   * @param userId ID of the user to create the task for
   * @param dueDate the due date selection option chosen by the user
   * @param args task creation arguments (without date fields)
   * @param api optional pre-fetched TodoistApi instance
   * @returns the created task
   * @throws {OAuthError} if no valid access token is found for the user
   * @throws {TodoistRequestError} if the API request fails
   */
  public async addTaskBySelectedDate(
    userId: string,
    dueDate: DueStringSelectionOptions | undefined,
    args: AddTaskArgsWithoutDates,
    api?: TodoistApi,
  ): Promise<Task> {
    return this.addTask(userId, {
      ...args,
      dueDate: dueDate ? this.dueStringToDate(dueDate) : undefined,
    } as AddTaskArgs, api);
  }

  /**
   * Converts a DueStringSelectionOptions value into a RFC 3339 date string.
   * @param dueString the due date option selected by the user
   * @returns a date string in RFC 3339 full-date format (YYYY-MM-DD)
   */
  private dueStringToDate(dueString: DueStringSelectionOptions): string {
    const date = new Date();
    switch (dueString) {
      case DueStringSelectionOptions.Today:
        break;
      case DueStringSelectionOptions.Tomorrow:
        date.setDate(date.getDate() + 1);
        break;
      case DueStringSelectionOptions.NextMonday: {
        const dayOfWeek = date.getDay();
        const daysUntilNextMonday = (8 - dayOfWeek) % 7 || 7;
        date.setDate(date.getDate() + daysUntilNextMonday);
        break;
      }
      case DueStringSelectionOptions.NextWeek:
        date.setDate(date.getDate() + 7);
        break;
      case DueStringSelectionOptions.NextMonth:
        date.setMonth(date.getMonth() + 1);
        break;
    }
    return date.toISOString().slice(0, 10);
  }
}
