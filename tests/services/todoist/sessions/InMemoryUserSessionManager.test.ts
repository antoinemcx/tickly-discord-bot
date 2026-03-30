import { InMemoryUserSessionManager } from "../../../../src/services/todoist/sessions/InMemoryUserSessionManager";
import { UserSession, UserSessionStatus } from "../../../../src/services/todoist/sessions/UserSession";

let sessionManager: InMemoryUserSessionManager;
let sessionMock: UserSession;

beforeEach(() => {
    sessionManager = new InMemoryUserSessionManager();
    sessionMock = {
        userId: "user1",
        oauthState: "state1",
        accessToken: "token1",
        expiresAt: new Date(Date.now() + 36000),
        status: UserSessionStatus.Pending,
    };
});

describe("InMemoryUserSessionManager", () => {
    describe("createSession", () => {
        test("should create a new session", async () => {
            // Act
            await sessionManager.createSession(sessionMock);

            // Assert
            const retrievedSession = await sessionManager.getSession("user1");
            expect(retrievedSession).toEqual(sessionMock);
        });

        test("should overwrite existing session for the same userId", async () => {
            // Arrange
            await sessionManager.createSession(sessionMock);
            const updatedSession = { ...sessionMock, accessToken: "token2" };

            // Act
            await sessionManager.createSession(updatedSession);

            // Assert
            const retrievedSession = await sessionManager.getSession("user1");
            expect(retrievedSession).toEqual(updatedSession);
        });
    });

    describe("getSessionByOAuthState", () => {
        test("should retrieve session by OAuth state", async () => {
            // Arrange
            await sessionManager.createSession(sessionMock);

            // Act
            const retrievedSession = await sessionManager.getSessionByOAuthState("state1");

            // Assert
            expect(retrievedSession).toEqual(sessionMock);
        });

        test("should return undefined for non-existing OAuth state", async () => {
            // Act
            const retrievedSession
                = await sessionManager.getSessionByOAuthState("nonexistent");
            // Assert
            expect(retrievedSession).toBeUndefined();
        });
    });

    describe("updateSession", () => {
        test("should update existing session with existing user ID", async () => {
            // Arrange
            await sessionManager.createSession(sessionMock);
            const updatedSession = { ...sessionMock, accessToken: "token2" };

            // Act
            await sessionManager.updateSession(updatedSession);

            // Assert
            const retrievedSession = await sessionManager.getSession("user1");
            expect(retrievedSession).toEqual(updatedSession);
        });

        test("should create a new session if user ID does not exist", async () => {
            // Arrange
            const newSession = { ...sessionMock, userId: "user2" };

            // Act
            await sessionManager.updateSession(newSession);

            // Assert
            const retrievedSession = await sessionManager.getSession("user2");
            expect(retrievedSession).toEqual(newSession);
        });
    });

    describe("deleteSession", () => {
        test("should delete existing session", async () => {
            // Arrange
            await sessionManager.createSession(sessionMock);
            // Act
            await sessionManager.deleteSession("user1");
            // Assert
            const retrievedSession = await sessionManager.getSession("user1");
            expect(retrievedSession).toBeUndefined();
        });
    });

    describe("pruneExpiredSessions", () => {
        test("should prune sessions with expired states", async () => {
            // Arrange
            const expiredSession = {
                ...sessionMock,
                userId: "user2",
                oauthState: "state2",
                expiresAt: new Date(Date.now() - 36000),
            };
            await sessionManager.createSession(sessionMock);
            await sessionManager.createSession(expiredSession);

            // Act
            await sessionManager.pruneExpiredSessions();

            // Assert
            const validSession = await sessionManager.getSession("user1");
            const prunedSession = await sessionManager.getSession("user2");
            expect(validSession).toEqual(sessionMock);
            expect(prunedSession).toBeUndefined();
        });
    });
});