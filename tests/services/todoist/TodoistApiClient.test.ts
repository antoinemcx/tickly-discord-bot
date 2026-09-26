import type {
  AuthTokenResponse,
} from "@doist/todoist-api-typescript";
import type { UserSessionManager } from "@services/todoist/sessions/UserSessionManager";
import {
  getAuthToken,
  TodoistApi,
  TodoistRequestError,
} from "@doist/todoist-api-typescript";
import { PersistenceError } from "@services/todoist/errors/PersistenceError";
import { UserSessionStatus } from "@services/todoist/sessions/UserSession";
import { DueStringSelectionOptions, TodoistApiClient } from "@services/todoist/TodoistApiClient";

jest.mock("@doist/todoist-api-typescript", () => {
  const actual = jest.requireActual("@doist/todoist-api-typescript");
  return {
    ...actual,
    getAuthToken: jest.fn(),
    addTask: jest.fn(),
  };
});

const TEST_CLIENT_ID = "test-client-id";
const TEST_CLIENT_SECRET = "test-client-secret";
const TEST_USER_ID = "test-user-id";
const TEST_ACCESS_TOKEN = "test-access-token";
const AUTHORIZE_BASE_URL = "https://todoist.com/oauth/authorize";

const mockSessionManager: UserSessionManager = {
  getSession: jest.fn(),
  getSessionByOAuthState: jest.fn(),
  createSession: jest.fn(),
  updateSession: jest.fn(),
  deleteSession: jest.fn(),
  pruneExpiredSessions: jest.fn(),
};
let todoistApiClientMock: TodoistApiClient;

beforeEach(() => {
  // Arrange
  jest.clearAllMocks();
  todoistApiClientMock = new TodoistApiClient(
    TEST_CLIENT_ID,
    TEST_CLIENT_SECRET,
    mockSessionManager,
  );
});

describe("TodoistApiClient", () => {
  describe("getSessionByUserId", () => {
    it("should return user session for valid user ID", async () => {
      // Arrange
      const expectedSession = {
        userId: TEST_USER_ID,
        accessToken: TEST_ACCESS_TOKEN,
      };
      mockSessionManager.getSession = jest.fn().mockResolvedValue(
        expectedSession,
      );

      // Act
      const session = await todoistApiClientMock.getSessionByUserId(TEST_USER_ID);

      // Assert
      expect(mockSessionManager.getSession).toHaveBeenCalledWith(TEST_USER_ID);
      expect(session).toEqual(expectedSession);
    });

    it("should return undefined for non-existent user ID", async () => {
      // Arrange
      const userId = "non-existent-user-id";
      mockSessionManager.getSession = jest.fn().mockResolvedValue(undefined);

      // Act
      const session = await todoistApiClientMock.getSessionByUserId(userId);

      // Assert
      expect(mockSessionManager.getSession).toHaveBeenCalledWith(userId);
      expect(session).toBeUndefined();
    });
  });

  describe("getSessionByOAuthState", () => {
    it("should return user session for valid OAuth state", async () => {
      // Arrange
      const oauthState = "test-oauth-state";
      const expectedSession = {
        userId: TEST_USER_ID,
        accessToken: TEST_ACCESS_TOKEN,
      };
      mockSessionManager.getSessionByOAuthState
        = jest.fn().mockResolvedValue(expectedSession);

      // Act
      const session
        = await todoistApiClientMock.getSessionByOAuthState(oauthState);

      // Assert
      expect(mockSessionManager.getSessionByOAuthState)
        .toHaveBeenCalledWith(oauthState);
      expect(session).toEqual(expectedSession);
    });

    it("should return undefined for non-existent OAuth state", async () => {
      // Arrange
      const oauthState = "non-existent-oauth-state";
      mockSessionManager.getSessionByOAuthState
        = jest.fn().mockResolvedValue(undefined);

      // Act
      const session
        = await todoistApiClientMock.getSessionByOAuthState(oauthState);

      // Assert
      expect(mockSessionManager.getSessionByOAuthState)
        .toHaveBeenCalledWith(oauthState);
      expect(session).toBeUndefined();
    });
  });

  describe("clearUserSession", () => {
    it("should call deleteSession with the correct userId", async () => {
      // Arrange
      mockSessionManager.deleteSession
        = jest.fn().mockResolvedValue(undefined);

      // Act
      await todoistApiClientMock.clearUserSession(TEST_USER_ID);

      // Assert
      expect(mockSessionManager.deleteSession).toHaveBeenCalledWith(
        TEST_USER_ID,
      );
    });

    it("should throw if session delete fails", async () => {
      // Arrange
      const error = new PersistenceError("Database error");
      mockSessionManager.deleteSession = jest.fn().mockRejectedValue(error);

      // Act & Assert
      await expect(todoistApiClientMock.clearUserSession(TEST_USER_ID))
        .rejects
        .toThrow(error);
    });
  });

  describe("pruneExpiredSessions", () => {
    it("should call pruneExpiredSessions on the session manager", async () => {
      // Arrange
      mockSessionManager.pruneExpiredSessions
        = jest.fn().mockResolvedValue(undefined);

      // Act
      await todoistApiClientMock.pruneExpiredSessions();

      // Assert
      expect(mockSessionManager.pruneExpiredSessions).toHaveBeenCalled();
    });

    it("should throw if expired sessions delete fails", async () => {
      // Arrange
      const error = new PersistenceError("Database error");
      mockSessionManager.pruneExpiredSessions
        = jest.fn().mockRejectedValue(error);

      // Act & Assert
      await expect(todoistApiClientMock.pruneExpiredSessions())
        .rejects
        .toThrow(error);
    });
  });

  describe("createOAuthAuthorizationUrl", () => {
    it("should generate the authorization URL", async () => {
      // Arrange
      const expectedAuthorizationUrlPattern = new RegExp(
        `^${AUTHORIZE_BASE_URL}\\?client_id=${TEST_CLIENT_ID}`
        + "&scope=data:read_write&state=.+$",
      );
      mockSessionManager.createSession = jest.fn().mockResolvedValue(undefined);

      // Act
      const url
        = await todoistApiClientMock.createOAuthAuthorizationUrl(TEST_USER_ID);

      // Assert
      expect(url).toMatch(expectedAuthorizationUrlPattern);
    });

    it("should create a new session if one doesn't exist", async () => {
      // Arrange
      mockSessionManager.getSession = jest.fn().mockResolvedValue(undefined);
      mockSessionManager.createSession = jest.fn().mockResolvedValue(undefined);

      // Act
      const _url
        = await todoistApiClientMock.createOAuthAuthorizationUrl(TEST_USER_ID);

      // Assert
      expect(mockSessionManager.getSession).toHaveBeenCalledWith(TEST_USER_ID);
      expect(mockSessionManager.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: TEST_USER_ID,
          status: UserSessionStatus.Pending,
          oauthState: expect.any(String),
        }),
      );
    });

    it("should replace existing session if one exists", async () => {
      // Arrange
      const existingSession = {
        userId: TEST_USER_ID,
        accessToken: "old-access-token",
      };
      mockSessionManager.getSession = jest.fn().mockResolvedValue(
        existingSession,
      );
      mockSessionManager.updateSession = jest.fn().mockResolvedValue(undefined);

      // Act
      const _url
        = await todoistApiClientMock.createOAuthAuthorizationUrl(TEST_USER_ID);

      // Assert
      expect(mockSessionManager.getSession).toHaveBeenCalledWith(TEST_USER_ID);
      expect(mockSessionManager.updateSession).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: TEST_USER_ID,
          status: UserSessionStatus.Pending,
          oauthState: expect.any(String),
        }),
      );
    });

    it("should throw if session persistence fails", async () => {
      // Arrange
      const error = new PersistenceError("Database error");
      mockSessionManager.getSession = jest.fn().mockResolvedValue(undefined);
      mockSessionManager.createSession = jest.fn().mockRejectedValue(error);

      // Act & Assert
      await expect(todoistApiClientMock.createOAuthAuthorizationUrl(
        TEST_USER_ID,
      )).rejects.toThrow(error);
    });

    it("should append the user locale to the URL state", async () => {
      // Arrange
      const locale = "fr";
      mockSessionManager.getSession = jest.fn().mockResolvedValue(undefined);
      mockSessionManager.createSession = jest.fn().mockResolvedValue(undefined);

      // Act
      const url = await todoistApiClientMock.createOAuthAuthorizationUrl(
        TEST_USER_ID,
        locale,
      );

      // Assert
      const urlState = new URL(url).searchParams.get("state") ?? "";
      const storedState = (mockSessionManager.createSession as jest.Mock)
        .mock
        .calls[0][0]
        .oauthState as string;
      expect(urlState).toBe(`${storedState}|${locale}`);
      expect(storedState).not.toContain("|");
    });

    it("should use the CSRF token as-is in the URL state when no locale is provided", async () => {
      // Arrange
      mockSessionManager.getSession = jest.fn().mockResolvedValue(undefined);
      mockSessionManager.createSession = jest.fn().mockResolvedValue(undefined);

      // Act
      const url = await todoistApiClientMock.createOAuthAuthorizationUrl(
        TEST_USER_ID,
      );

      // Assert
      const urlState = new URL(url).searchParams.get("state") ?? "";
      const storedState = (mockSessionManager.createSession as jest.Mock)
        .mock
        .calls[0][0]
        .oauthState as string;
      expect(urlState).toBe(storedState);
    });
  });

  describe("exchangeOAuthCodeForAccessToken", () => {
    const mockedGetAuthToken = getAuthToken as jest.MockedFunction<typeof getAuthToken>;

    beforeEach(() => {
      mockedGetAuthToken.mockReset();
    });

    it("should exchange code for access token", async () => {
      // Arrange
      const todoistTokenResponse: AuthTokenResponse = {
        accessToken: TEST_ACCESS_TOKEN,
        tokenType: "Bearer",
      };
      const code = "test-auth-code";
      mockedGetAuthToken.mockResolvedValue(todoistTokenResponse);

      // Act
      const accessToken
        = await todoistApiClientMock.exchangeOAuthCodeForAccessToken(code);

      // Assert
      expect(accessToken).toEqual(todoistTokenResponse.accessToken);
    });

    it("should throw if token exchange fails", async () => {
      // Arrange
      const error = new TodoistRequestError("Token exchange failed");
      const code = "test-auth-code";
      mockedGetAuthToken.mockRejectedValue(error);

      // Act & Assert
      await expect(
        todoistApiClientMock.exchangeOAuthCodeForAccessToken(code),
      ).rejects.toThrow(error);
    });
  });

  describe("registerUserAccessToken", () => {
    it("should create a new session if one doesn't exist", async () => {
      // Arrange
      mockSessionManager.getSession = jest.fn().mockResolvedValue(undefined);
      mockSessionManager.createSession = jest.fn().mockResolvedValue(undefined);

      // Act
      await todoistApiClientMock.registerUserAccessToken(
        TEST_USER_ID,
        TEST_ACCESS_TOKEN,
      );

      // Assert
      expect(mockSessionManager.getSession).toHaveBeenCalledWith(TEST_USER_ID);
      expect(mockSessionManager.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: TEST_USER_ID,
          status: UserSessionStatus.Completed,
          accessToken: TEST_ACCESS_TOKEN,
        }),
      );
    });

    it("should update existing session if one exists", async () => {
      // Arrange
      const existingSession = {
        userId: TEST_USER_ID,
        accessToken: "old-access-token",
      };
      mockSessionManager.getSession = jest.fn().mockResolvedValue(
        existingSession,
      );
      mockSessionManager.updateSession = jest.fn().mockResolvedValue(undefined);

      // Act
      await todoistApiClientMock.registerUserAccessToken(
        TEST_USER_ID,
        TEST_ACCESS_TOKEN,
      );

      // Assert
      expect(mockSessionManager.getSession).toHaveBeenCalledWith(TEST_USER_ID);
      expect(mockSessionManager.updateSession).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: TEST_USER_ID,
          status: UserSessionStatus.Completed,
          accessToken: TEST_ACCESS_TOKEN,
        }),
      );
    });

    it("should throw if session persistence fails", async () => {
      // Arrange
      const error = new PersistenceError("Database error");
      mockSessionManager.getSession = jest.fn().mockResolvedValue(undefined);
      mockSessionManager.createSession = jest.fn().mockRejectedValue(error);

      // Act & Assert
      await expect(
        todoistApiClientMock.registerUserAccessToken(
          TEST_USER_ID,
          TEST_ACCESS_TOKEN,
        ),
      ).rejects.toThrow(error);
    });
  });

  describe("getUserApi", () => {
    it("should create a Todoist API client instance for the user", async () => {
      // Arrange
      mockSessionManager.getSession = jest.fn().mockResolvedValue({
        userId: TEST_USER_ID,
        accessToken: TEST_ACCESS_TOKEN,
      });

      // Act
      const apiInstance = await todoistApiClientMock.getUserApi(TEST_USER_ID);

      // Assert
      expect(mockSessionManager.getSession).toHaveBeenCalledWith(TEST_USER_ID);
      expect(apiInstance).toBeInstanceOf(TodoistApi);
      expect((apiInstance as any).authToken).toEqual(TEST_ACCESS_TOKEN);
    });

    it("should throw if no session is found for the user", async () => {
      // Arrange
      mockSessionManager.getSession = jest.fn().mockResolvedValue(undefined);

      // Act & Assert
      await expect(
        todoistApiClientMock.getUserApi(TEST_USER_ID),
      ).rejects.toThrow(/No Todoist access token found for user/);
    });

    it("should throw if user session has no access token", async () => {
      // Arrange
      mockSessionManager.getSession = jest.fn().mockResolvedValue({
        userId: TEST_USER_ID,
        accessToken: "",
      });

      // Act & Assert
      await expect(
        todoistApiClientMock.getUserApi(TEST_USER_ID),
      ).rejects.toThrow(/No Todoist access token found for user/);
    });
  });

  describe("addTask", () => {
    it("should add a task for the user", async () => {
      // Arrange
      const taskArgs = {
        content: "Test task",
      };
      const createdTask = {
        id: "test-task-id",
        content: taskArgs.content,
      };
      const addTaskMock = jest.fn().mockResolvedValue(createdTask);
      todoistApiClientMock.getUserApi = jest.fn().mockResolvedValue({
        addTask: addTaskMock,
      });
      mockSessionManager.getSession = jest.fn().mockResolvedValue({
        userId: TEST_USER_ID,
        accessToken: TEST_ACCESS_TOKEN,
      });

      // Act
      const result
        = await todoistApiClientMock.addTask(TEST_USER_ID, taskArgs);

      // Assert
      expect(addTaskMock).toHaveBeenCalledWith(taskArgs);
      expect(result).toEqual(createdTask);
    });

    it("should use the provided api instance instead of fetching one", async () => {
      // Arrange
      const taskArgs = {
        content: "Test task",
      };
      const createdTask = {
        id: "test-task-id",
        content: taskArgs.content,
      };
      const addTaskMock = jest.fn().mockResolvedValue(createdTask);
      const providedApi = {
        addTask: addTaskMock,
      } as unknown as import("@doist/todoist-api-typescript").TodoistApi;
      const getUserApiSpy = jest.spyOn(todoistApiClientMock, "getUserApi");

      // Act
      const result
        = await todoistApiClientMock.addTask(TEST_USER_ID, taskArgs, providedApi);

      // Assert
      expect(addTaskMock).toHaveBeenCalledWith(taskArgs);
      expect(result).toEqual(createdTask);
      expect(getUserApiSpy).not.toHaveBeenCalled();
    });
  });

  describe("quickAddTask", () => {
    it("should add a task for the user", async () => {
      // Arrange
      const taskArgs = {
        text: "Test task",
      };
      const createdTask = {
        id: "test-task-id",
        content: taskArgs.text,
      };
      const addTaskMock = jest.fn().mockResolvedValue(createdTask);
      todoistApiClientMock.getUserApi = jest.fn().mockResolvedValue({
        quickAddTask: addTaskMock,
      });
      mockSessionManager.getSession = jest.fn().mockResolvedValue({
        userId: TEST_USER_ID,
        accessToken: TEST_ACCESS_TOKEN,
      });

      // Act
      const result
        = await todoistApiClientMock.quickAddTask(TEST_USER_ID, taskArgs);

      // Assert
      expect(addTaskMock).toHaveBeenCalledWith(taskArgs);
      expect(result).toEqual(createdTask);
    });

    it("should use the provided api instance instead of fetching one", async () => {
      // Arrange
      const taskArgs = {
        text: "Test task",
      };
      const createdTask = {
        id: "test-task-id",
        content: taskArgs.text,
      };
      const addTaskMock = jest.fn().mockResolvedValue(createdTask);
      const providedApi = {
        quickAddTask: addTaskMock,
      } as unknown as import("@doist/todoist-api-typescript").TodoistApi;
      const getUserApiSpy = jest.spyOn(todoistApiClientMock, "getUserApi");

      // Act
      const result
        = await todoistApiClientMock.quickAddTask(TEST_USER_ID, taskArgs, providedApi);

      // Assert
      expect(addTaskMock).toHaveBeenCalledWith(taskArgs);
      expect(result).toEqual(createdTask);
      expect(getUserApiSpy).not.toHaveBeenCalled();
    });
  });

  describe("addTaskBySelectedDate", () => {
    it("should add a task with today's date when Today is selected", async () => {
      // Arrange
      const taskArgs = { content: "Test task" };
      const createdTask = { id: "test-task-id", content: taskArgs.content };
      const addTaskMock = jest.fn().mockResolvedValue(createdTask);
      todoistApiClientMock.getUserApi = jest.fn().mockResolvedValue({
        addTask: addTaskMock,
      });
      mockSessionManager.getSession = jest.fn().mockResolvedValue({
        userId: TEST_USER_ID,
        accessToken: TEST_ACCESS_TOKEN,
      });
      const expectedDate = new Date().toISOString().slice(0, 10);

      // Act
      const result = await todoistApiClientMock.addTaskBySelectedDate(
        TEST_USER_ID,
        DueStringSelectionOptions.Today,
        taskArgs,
      );

      // Assert
      expect(addTaskMock).toHaveBeenCalledWith({
        ...taskArgs,
        dueDate: expectedDate,
      });
      expect(result).toEqual(createdTask);
    });

    it("should add a task with tomorrow's date when Tomorrow is selected", async () => {
      // Arrange
      const taskArgs = { content: "Test task" };
      const createdTask = { id: "test-task-id", content: taskArgs.content };
      const addTaskMock = jest.fn().mockResolvedValue(createdTask);
      todoistApiClientMock.getUserApi = jest.fn().mockResolvedValue({
        addTask: addTaskMock,
      });
      mockSessionManager.getSession = jest.fn().mockResolvedValue({
        userId: TEST_USER_ID,
        accessToken: TEST_ACCESS_TOKEN,
      });
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const expectedDate = tomorrow.toISOString().slice(0, 10);

      // Act
      const result = await todoistApiClientMock.addTaskBySelectedDate(
        TEST_USER_ID,
        DueStringSelectionOptions.Tomorrow,
        taskArgs,
      );

      // Assert
      expect(addTaskMock).toHaveBeenCalledWith({
        ...taskArgs,
        dueDate: expectedDate,
      });
      expect(result).toEqual(createdTask);
    });

    it("should add a task with next Monday's date when NextMonday is selected", async () => {
      // Arrange
      const taskArgs = { content: "Test task" };
      const createdTask = { id: "test-task-id", content: taskArgs.content };
      const addTaskMock = jest.fn().mockResolvedValue(createdTask);
      todoistApiClientMock.getUserApi = jest.fn().mockResolvedValue({
        addTask: addTaskMock,
      });
      mockSessionManager.getSession = jest.fn().mockResolvedValue({
        userId: TEST_USER_ID,
        accessToken: TEST_ACCESS_TOKEN,
      });

      const today = new Date();
      const dayOfWeek = today.getDay();
      const daysUntilNextMonday = (8 - dayOfWeek) % 7 || 7;
      const nextMonday = new Date(today);
      nextMonday.setDate(today.getDate() + daysUntilNextMonday);
      const expectedDate = nextMonday.toISOString().slice(0, 10);

      // Act
      const result = await todoistApiClientMock.addTaskBySelectedDate(
        TEST_USER_ID,
        DueStringSelectionOptions.NextMonday,
        taskArgs,
      );

      // Assert
      expect(addTaskMock).toHaveBeenCalledWith({
        ...taskArgs,
        dueDate: expectedDate,
      });
      expect(result).toEqual(createdTask);
    });

    it("should add a task with next week's date when NextWeek is selected", async () => {
      // Arrange
      const taskArgs = { content: "Test task" };
      const createdTask = { id: "test-task-id", content: taskArgs.content };
      const addTaskMock = jest.fn().mockResolvedValue(createdTask);
      todoistApiClientMock.getUserApi = jest.fn().mockResolvedValue({
        addTask: addTaskMock,
      });
      mockSessionManager.getSession = jest.fn().mockResolvedValue({
        userId: TEST_USER_ID,
        accessToken: TEST_ACCESS_TOKEN,
      });
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const expectedDate = nextWeek.toISOString().slice(0, 10);

      // Act
      const result = await todoistApiClientMock.addTaskBySelectedDate(
        TEST_USER_ID,
        DueStringSelectionOptions.NextWeek,
        taskArgs,
      );

      // Assert
      expect(addTaskMock).toHaveBeenCalledWith({
        ...taskArgs,
        dueDate: expectedDate,
      });
      expect(result).toEqual(createdTask);
    });

    it("should add a task with next month's date when NextMonth is selected", async () => {
      // Arrange
      const taskArgs = { content: "Test task" };
      const createdTask = { id: "test-task-id", content: taskArgs.content };
      const addTaskMock = jest.fn().mockResolvedValue(createdTask);
      todoistApiClientMock.getUserApi = jest.fn().mockResolvedValue({
        addTask: addTaskMock,
      });
      mockSessionManager.getSession = jest.fn().mockResolvedValue({
        userId: TEST_USER_ID,
        accessToken: TEST_ACCESS_TOKEN,
      });
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const expectedDate = nextMonth.toISOString().slice(0, 10);

      // Act
      const result = await todoistApiClientMock.addTaskBySelectedDate(
        TEST_USER_ID,
        DueStringSelectionOptions.NextMonth,
        taskArgs,
      );

      // Assert
      expect(addTaskMock).toHaveBeenCalledWith({
        ...taskArgs,
        dueDate: expectedDate,
      });
      expect(result).toEqual(createdTask);
    });

    it("should add a task with no due date when None is selected", async () => {
      // Arrange
      const taskArgs = { content: "Test task" };
      const createdTask = { id: "test-task-id", content: taskArgs.content };
      const addTaskMock = jest.fn().mockResolvedValue(createdTask);
      todoistApiClientMock.getUserApi = jest.fn().mockResolvedValue({
        addTask: addTaskMock,
      });
      mockSessionManager.getSession = jest.fn().mockResolvedValue({
        userId: TEST_USER_ID,
        accessToken: TEST_ACCESS_TOKEN,
      });

      // Act
      const result = await todoistApiClientMock.addTaskBySelectedDate(
        TEST_USER_ID,
        undefined,
        taskArgs,
      );

      // Assert
      expect(addTaskMock).toHaveBeenCalledWith({
        ...taskArgs,
        dueDate: undefined,
      });
      expect(result).toEqual(createdTask);
    });

    it("should use the provided api instance instead of fetching one", async () => {
      // Arrange
      const taskArgs = { content: "Test task" };
      const createdTask = { id: "test-task-id", content: taskArgs.content };
      const addTaskMock = jest.fn().mockResolvedValue(createdTask);
      const providedApi = {
        addTask: addTaskMock,
      } as unknown as import("@doist/todoist-api-typescript").TodoistApi;
      const getUserApiSpy = jest.spyOn(todoistApiClientMock, "getUserApi");

      // Act
      const result = await todoistApiClientMock.addTaskBySelectedDate(
        TEST_USER_ID,
        DueStringSelectionOptions.Today,
        taskArgs,
        providedApi,
      );

      // Assert
      expect(result).toEqual(createdTask);
      expect(getUserApiSpy).not.toHaveBeenCalled();
    });
  });
});
