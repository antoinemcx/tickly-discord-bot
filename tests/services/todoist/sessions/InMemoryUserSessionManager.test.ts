import type { UserSession } from "@services/todoist/sessions/UserSession";
import { InMemoryUserSessionManager } from "@services/todoist/sessions/InMemoryUserSessionManager";
import { UserSessionStatus } from "@services/todoist/sessions/UserSession";

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
    it("should create a new session", async () => {
      // Act
      await sessionManager.createSession(sessionMock);

      // Assert
      const retrievedSession = await sessionManager.getSession("user1");
      expect(retrievedSession).toEqual(sessionMock);
    });

    it("should overwrite existing session for the same userId", async () => {
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
    it("should retrieve session by OAuth state", async () => {
      // Arrange
      await sessionManager.createSession(sessionMock);

      // Act
      const retrievedSession = await sessionManager.getSessionByOAuthState("state1");

      // Assert
      expect(retrievedSession).toEqual(sessionMock);
    });

    it("should return undefined for non-existing OAuth state", async () => {
      // Act
      const retrievedSession
        = await sessionManager.getSessionByOAuthState("nonexistent");
      // Assert
      expect(retrievedSession).toBeUndefined();
    });
  });

  describe("updateSession", () => {
    it("should update existing session with existing user ID", async () => {
      // Arrange
      await sessionManager.createSession(sessionMock);
      const updatedSession = { ...sessionMock, accessToken: "token2" };

      // Act
      await sessionManager.updateSession(updatedSession);

      // Assert
      const retrievedSession = await sessionManager.getSession("user1");
      expect(retrievedSession).toEqual(updatedSession);
    });

    it("should create a new session if user ID does not exist", async () => {
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
    it("should delete existing session", async () => {
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
    it("should prune sessions with expired states", async () => {
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

  describe("touchSession", () => {
    it("should resolve without modifying the stored session", async () => {
      // Arrange
      await sessionManager.createSession(sessionMock);

      // Act
      await sessionManager.touchSession("user1");

      // Assert
      const session = await sessionManager.getSession("user1");
      expect(session).toEqual(sessionMock);
    });

    it("should resolve even when no session exists for the userId", async () => {
      // Act & Assert
      await expect(sessionManager.touchSession("nonexistent")).resolves.toBeUndefined();
    });
  });
});
