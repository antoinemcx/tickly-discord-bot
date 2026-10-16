import type { UserRepository } from "@database/repositories/UserRepository";
import type {
  AddTaskArgs,
  GetTasksResponse,
  Permission,
  QuickAddTaskArgs,
  Task,
  UpdateTaskArgs,
} from "@doist/todoist-api-typescript";
import type { RedisService } from "@services/cache/RedisService";
import type { UserSessionManager } from "../../services/todoist/sessions/UserSessionManager";
import {
  getAuthorizationUrl,
  getAuthStateParameter,
  getAuthToken,
  TodoistApi,
  TodoistRequestError,
} from "@doist/todoist-api-typescript";
import { displayDetailedError } from "@src/utils/logger";
import { UserSession, UserSessionStatus } from "../../services/todoist/sessions/UserSession";
import { OAuthError } from "./errors/OAuthError";
import { TaskNotFoundError } from "./errors/TaskNotFoundError";

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
  private readonly userRepository: UserRepository;
  private readonly redisService?: RedisService;

  /**
   * Creates a reusable application-level Todoist client.
   *
   * @param clientId the Todoist API client ID
   * @param clientSecret the Todoist API client secret
   * @param sessionManager the session manager to use for managing user sessions
   * @param userRepository the user repository for ensuring users exist
   * @param options the options for configuring the Todoist client, which
   *   includes Todoist permissions of the client and the lifetime
   *   of the OAuth state values (valid sessions don't expire)
   * @param redisService optional Redis caching layer
   */
  public constructor(
    clientId: string,
    clientSecret: string,
    sessionManager: UserSessionManager,
    userRepository: UserRepository,
    options?: TodoistClientOptions,
    redisService?: RedisService,
  ) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.permissions = options?.permissions
      ?? TodoistApiClient.DEFAULT_PERMISSIONS;
    this.oauthStateLifetimeMs = options?.oauthStateLifetimeMs
      ?? TodoistApiClient.DEFAULT_OAUTH_STATE_LIFETIME_MS;
    this.sessionManager = sessionManager;
    this.userRepository = userRepository;
    this.redisService = redisService;
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
   * Also removes the cached access token from Redis if available.
   *
   * @params userId ID of the user whose session should be deleted
   * @returns a promise resolving when the session is cleared
   * @throws {PersistenceError} if session deletion fails
   */
  public async clearUserSession(userId: string): Promise<void> {
    await this.sessionManager.deleteSession(userId);
    await this.redisService?.delete(`tickly:access_token:${userId}`);
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

    await this.userRepository.ensureUserExists(userId);
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

    await this.userRepository.ensureUserExists(userId);
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
   * Retrieves a user's access token, checking Redis cache first.
   * On a cache hit the DB session is still touched to keep it alive.
   * On a cache miss the token is fetched from DB and stored in Redis.
   *
   * @params userId ID of the user to retrieve the access token for
   * @returns the access token for the given user, or undefined if none exists.
   */
  private async getUserAccessToken(userId: string): Promise<string | undefined> {
    /* Try cache first */
    if (this.redisService?.isAvailable()) {
      const cachedToken = await this.redisService.get<string>(
        `tickly:access_token:${userId}`,
      );
      if (cachedToken !== null) {
        await this.touchUserSession(userId);
        return cachedToken;
      }
    }

    /* Fall back to DB value */
    const session = await this.getSessionByUserId(userId);
    const token = session?.accessToken;

    if (token && token.length > 0) {
      await this.redisService?.set(`tickly:access_token:${userId}`, token, 1200);
      await this.touchUserSession(userId);
      return token;
    }
    return undefined;
  }

  /**
   * Fetches all active (non-completed) tasks for the given user,
   * automatically handling cursor-based pagination internally.
   *
   * @param userId ID of the user to fetch tasks for
   * @param api optional pre-fetched TodoistApi instance
   * @returns array of all active tasks across all pages
   * @throws {OAuthError} if no valid access token is found for the user
   * @throws {TodoistRequestError} if the API request fails
   */
  public async getActiveTasks(userId: string, api?: TodoistApi): Promise<Task[]> {
    const client = api ?? await this.getUserApi(userId);
    const tasks: Task[] = [];
    let cursor: string | null = null;

    do {
      const response: GetTasksResponse = await client.getTasks({ cursor, limit: 200 });
      tasks.push(...response.results);
      cursor = response.nextCursor;
    } while (cursor !== null);

    return tasks;
  }

  /**
   * Creates a Todoist task for the given user.
   * @param userId ID of the user to create the task for
   * @param args the arguments for creating the task
   * @param api optional pre-fetched TodoistApi instance
   * @returns the created task
   * @throws {OAuthError} if no valid access token is found for the user
   * @throws {TaskNotFoundError} if a parent task (parentId) does not exist
   * @throws {TodoistRequestError} if the API request fails
   */
  public async addTask(userId: string, args: AddTaskArgs, api?: TodoistApi): Promise<Task> {
    const client = api ?? await this.getUserApi(userId);
    try {
      return await client.addTask(args);
    } catch (error) {
      if (args.parentId) {
        throw this.mapApiError(error, userId, args.parentId);
      }
      throw error;
    }
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

  /**
   * Returns the task's due date as a local-timezone `Date` at midnight (00:00:00).
   * Todoist's `due.date` may include time information ("YYYY-MM-DDTHH:MM:SS+HH:MM"),
   * so only the first ten characters are used to build the date.
   *
   * @param task the Todoist task to read
   * @returns a Date at local midnight, or null when the task has no due date
   */
  public static getTaskDueDate(task: Task): Date | null {
    if (!task.due?.date)
      return null;
    const [year, month, day] = task.due.date.slice(0, 10).split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  /**
   * Closes (completes) a Todoist task for the given user.
   * @param userId ID of the user to close the task for
   * @param taskId ID of the task to close
   * @param api optional pre-fetched TodoistApi instance
   * @returns true if the task was successfully closed
   * @throws {OAuthError} if no valid access token is found for the user
   * @throws {TaskNotFoundError} if the task does not exist
   * @throws {TodoistRequestError} if the API request fails
   */
  public async closeTask(userId: string, taskId: string, api?: TodoistApi): Promise<boolean> {
    const client = api ?? await this.getUserApi(userId);
    try {
      return await client.closeTask(taskId);
    } catch (error) {
      throw this.mapApiError(error, userId, taskId);
    }
  }

  /**
   * Deletes a Todoist task for the given user.
   * @param userId ID of the user to delete the task for
   * @param taskId ID of the task to delete
   * @param api optional pre-fetched TodoistApi instance
   * @returns true if the task was successfully deleted
   * @throws {OAuthError} if no valid access token is found for the user
   * @throws {TaskNotFoundError} if the task does not exist
   * @throws {TodoistRequestError} if the API request fails
   */
  public async deleteTask(userId: string, taskId: string, api?: TodoistApi): Promise<boolean> {
    const client = api ?? await this.getUserApi(userId);
    try {
      return await client.deleteTask(taskId);
    } catch (error) {
      throw this.mapApiError(error, userId, taskId);
    }
  }

  /**
   * Fetches a single Todoist task by its ID for the given user.
   * @param userId ID of the user to fetch the task for
   * @param taskId ID of the task to fetch
   * @param api optional pre-fetched TodoistApi instance
   * @returns the requested task
   * @throws {OAuthError} if no valid access token is found for the user
   * @throws {TaskNotFoundError} if the task does not exist
   * @throws {TodoistRequestError} if the API request fails
   */
  public async getTask(userId: string, taskId: string, api?: TodoistApi): Promise<Task> {
    const client = api ?? await this.getUserApi(userId);
    try {
      return await client.getTask(taskId);
    } catch (error) {
      throw this.mapApiError(error, userId, taskId);
    }
  }

  /**
   * Updates a Todoist task for the given user.
   * @param userId ID of the user to update the task for
   * @param taskId ID of the task to update
   * @param args the arguments for updating the task
   * @param api optional pre-fetched TodoistApi instance
   * @returns the updated task
   * @throws {OAuthError} if no valid access token is found for the user
   * @throws {TaskNotFoundError} if the task does not exist
   * @throws {TodoistRequestError} if the API request fails
   */
  public async updateTask(
    userId: string,
    taskId: string,
    args: UpdateTaskArgs,
    api?: TodoistApi,
  ): Promise<Task> {
    const client = api ?? await this.getUserApi(userId);
    try {
      return await client.updateTask(taskId, args);
    } catch (error) {
      throw this.mapApiError(error, userId, taskId);
    }
  }

  /**
   * Returns a Unix timestamp (ms) for a task's due date or datetime.
   * Suitable for sorting tasks chronologically.
   *
   * @param task the Todoist task to read
   * @param endOfDayForDateOnly when `true`, date-only tasks receive a timestamp
   *   shifted to 23:59:59 of their due day so they sort after timed tasks on
   *   the same calendar date
   * @returns the Unix timestamp in milliseconds, or `Number.MAX_SAFE_INTEGER`
   *   when the task has no due date or the date cannot be parsed
   */
  public static getTaskTimestamp(task: Task, endOfDayForDateOnly = false): number {
    const src = task.due?.datetime ?? task.due?.date;
    if (!src) {
      return Number.MAX_SAFE_INTEGER;
    }
    const ts = new Date(src).getTime();
    if (Number.isNaN(ts)) {
      return Number.MAX_SAFE_INTEGER;
    }

    const hasTime = !!task.due?.datetime || (task.due?.date?.includes("T") ?? false);
    return hasTime || !endOfDayForDateOnly ? ts : ts + 86399000;
  }

  /**
   * Attempts to update the last_used_at timestamp for a user session.
   * Failures do not interrupt the caller.
   * @param userId ID of the user whose session should be touched
   */
  private async touchUserSession(userId: string): Promise<void> {
    try {
      await this.sessionManager.touchSession(userId);
    } catch (error) {
      displayDetailedError(
        `Failed to update last_used_at for user session '${userId}'.`,
        error,
      );
    }
  }

  /**
   * Maps known Todoist API errors to domain-specific error types.
   * - HTTP 401 : OAuthError (token is invalid or revoked; the cached
   *   token is also cleared from Redis)
   * - HTTP 404 : TaskNotFoundError
   *
   * 403 Forbidden is intentionally NOT mapped: it may indicate a workspace
   * project permission issue rather than an invalid token, so the original
   * TodoistRequestError is re-thrown unchanged.
   *
   * Re-throws the original error if it doesn't match any known pattern.
   */
  private mapApiError(error: unknown, userId: string, taskId: string): Error {
    if (error instanceof TodoistRequestError) {
      if (error.httpStatusCode === 401) {
        void this.redisService?.delete(`tickly:access_token:${userId}`);
        return new OAuthError(
          `Todoist access token for user ${userId} is no longer valid.`,
        );
      }
      if (error.httpStatusCode === 404) {
        return new TaskNotFoundError(taskId);
      }
    }
    return error instanceof Error ? error : new Error(String(error));
  }
}
