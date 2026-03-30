import { UserSessionManager } from "../../../src/services/todoist/sessions/UserSessionManager";
import { TodoistApiClient } from "../../../src/services/todoist/TodoistApiClient";
import { PersistenceError } from "../../../src/services/todoist/errors/PersistenceError";
import {
    AuthTokenResponse,
    TodoistApi,
    TodoistRequestError,
    getAuthToken,
} from "@doist/todoist-api-typescript";
import { UserSessionStatus } from "../../../src/services/todoist/sessions/UserSession";

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
    todoistApiClientMock = new TodoistApiClient(
        TEST_CLIENT_ID, TEST_CLIENT_SECRET, mockSessionManager);
    jest.restoreAllMocks();
});

describe("TodoistApiClient", () => {
    describe("getSessionByUserId", () => {
        test("should return user session for valid user ID", async () => {
            // Arrange
            const expectedSession = {
                userId: TEST_USER_ID,
                accessToken: TEST_ACCESS_TOKEN,
            };
            mockSessionManager.getSession = jest.fn().mockResolvedValue(
                expectedSession);
            
            // Act
            const session = await todoistApiClientMock.getSessionByUserId(TEST_USER_ID);

            // Assert
            expect(mockSessionManager.getSession).toHaveBeenCalledWith(TEST_USER_ID);
            expect(session).toEqual(expectedSession);
        });

        test("should return undefined for non-existent user ID", async () => {
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
        test("should return user session for valid OAuth state", async () => {
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

        test("should return undefined for non-existent OAuth state", async () => {
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
        test("should call deleteSession with the correct userId", async () => {
            // Arrange
            mockSessionManager.deleteSession
                = jest.fn().mockResolvedValue(undefined);

            // Act
            await todoistApiClientMock.clearUserSession(TEST_USER_ID);

            // Assert
            expect(mockSessionManager.deleteSession).toHaveBeenCalledWith(
                TEST_USER_ID);
        });

        test("should throw if session delete fails", async () => {
            // Arrange
            const error = new PersistenceError("Database error");
            mockSessionManager.deleteSession = jest.fn().mockRejectedValue(error);

            // Act & Assert
            await expect(todoistApiClientMock.clearUserSession(TEST_USER_ID))
                .rejects.toThrow(error);
        });
    });

    describe("pruneExpiredSessions", () => {
        test("should call pruneExpiredSessions on the session manager", async () => {
            // Arrange
            mockSessionManager.pruneExpiredSessions
                = jest.fn().mockResolvedValue(undefined);

            // Act
            await todoistApiClientMock.pruneExpiredSessions();

            // Assert
            expect(mockSessionManager.pruneExpiredSessions).toHaveBeenCalled();
        });

        test("should throw if expired sessions delete fails", async () => {
            // Arrange
            const error = new PersistenceError("Database error");
            mockSessionManager.pruneExpiredSessions
                = jest.fn().mockRejectedValue(error);

            // Act & Assert
            await expect(todoistApiClientMock.pruneExpiredSessions())
                .rejects.toThrow(error);
        });
    });

    describe("createOAuthAuthorizationUrl", () => {
        test("should generate the authorization URL", async () => {
            // Arrange
            const expectedAuthorizationUrlPattern = new RegExp(
                `^${AUTHORIZE_BASE_URL}\\?client_id=${TEST_CLIENT_ID}`
                + "&scope=data:read_write&state=.+$"
            );
            mockSessionManager.createSession = jest.fn().mockResolvedValue(undefined);

            // Act
            const url
                = await todoistApiClientMock.createOAuthAuthorizationUrl(TEST_USER_ID);

            // Assert
            expect(url).toMatch(expectedAuthorizationUrlPattern);
        });

        test("should create a new session if one doesn't exist", async () => {
            // Arrange
            mockSessionManager.getSession = jest.fn().mockResolvedValue(undefined);
            mockSessionManager.createSession = jest.fn().mockResolvedValue(undefined);

            // Act
            const url
                = await todoistApiClientMock.createOAuthAuthorizationUrl(TEST_USER_ID);

            // Assert
            expect(mockSessionManager.getSession).toHaveBeenCalledWith(TEST_USER_ID);
            expect(mockSessionManager.createSession).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: TEST_USER_ID,
                    status: UserSessionStatus.Pending,
                    oauthState: expect.any(String),
                })
            );
        });

        test("should replace existing session if one exists", async () => {
            // Arrange
            const existingSession = {
                userId: TEST_USER_ID,
                accessToken: "old-access-token",
            };
            mockSessionManager.getSession = jest.fn().mockResolvedValue(
                existingSession);
            mockSessionManager.updateSession = jest.fn().mockResolvedValue(undefined);

            // Act
            const url
                = await todoistApiClientMock.createOAuthAuthorizationUrl(TEST_USER_ID);

            // Assert
            expect(mockSessionManager.getSession).toHaveBeenCalledWith(TEST_USER_ID);
            expect(mockSessionManager.updateSession).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: TEST_USER_ID,
                    status: UserSessionStatus.Pending,
                    oauthState: expect.any(String),
                })
            );
        });

        test("should throw if session persistence fails", async () => {
            // Arrange
            const error = new PersistenceError("Database error");
            mockSessionManager.getSession = jest.fn().mockResolvedValue(undefined);
            mockSessionManager.createSession = jest.fn().mockRejectedValue(error);

            // Act & Assert
            await expect(todoistApiClientMock.createOAuthAuthorizationUrl(
                TEST_USER_ID)).rejects.toThrow(error);
        });
    });

    describe("exchangeOAuthCodeForAccessToken", () => {
        const mockedGetAuthToken = getAuthToken as jest.MockedFunction<typeof getAuthToken>;

        beforeEach(() => {
            mockedGetAuthToken.mockReset();
        });

        test("should exchange code for access token", async () => {
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

        test("should throw if token exchange fails", async () => {
            // Arrange
            const error = new TodoistRequestError("Token exchange failed");
            const code = "test-auth-code";
            mockedGetAuthToken.mockRejectedValue(error);

            // Act & Assert
            await expect(
                todoistApiClientMock.exchangeOAuthCodeForAccessToken(code)
            ).rejects.toThrow(error);
        });
    });

    describe("registerUserAccessToken", () => {
        test("should create a new session if one doesn't exist", async () => {
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

        test("should update existing session if one exists", async () => {
            // Arrange
            const existingSession = {
                userId: TEST_USER_ID,
                accessToken: "old-access-token",
            };
            mockSessionManager.getSession = jest.fn().mockResolvedValue(
                existingSession);
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

        test("should throw if session persistence fails", async () => {
            // Arrange
            const error = new PersistenceError("Database error");
            mockSessionManager.getSession = jest.fn().mockResolvedValue(undefined);
            mockSessionManager.createSession = jest.fn().mockRejectedValue(error);

            // Act & Assert
            await expect(
                todoistApiClientMock.registerUserAccessToken(
                    TEST_USER_ID,
                    TEST_ACCESS_TOKEN,
                )
            ).rejects.toThrow(error);
        });
    });

    describe("getUserApi", () => {
        test("should create a Todoist API client instance for the user", async () => {
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

        test("should throw if no session is found for the user", async () => {
            // Arrange
            mockSessionManager.getSession = jest.fn().mockResolvedValue(undefined);

            // Act & Assert
            await expect(
                todoistApiClientMock.getUserApi(TEST_USER_ID)
            ).rejects.toThrow(/No Todoist access token found for user/);
        });

        test("should throw if user session has no access token", async () => {
            // Arrange
            mockSessionManager.getSession = jest.fn().mockResolvedValue({
                userId: TEST_USER_ID,
                accessToken: "",
            });

            // Act & Assert
            await expect(
                todoistApiClientMock.getUserApi(TEST_USER_ID)
            ).rejects.toThrow(/No Todoist access token found for user/);
        });
    });

    describe("addTaskForUser", () => {
        test("should add a task for the user", async () => {
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
            const result = await todoistApiClientMock.addTaskForUser(
                TEST_USER_ID,
                taskArgs,
            );

            // Assert
            expect(addTaskMock).toHaveBeenCalledWith(taskArgs);
            expect(result).toEqual(createdTask);
        });
    });
});