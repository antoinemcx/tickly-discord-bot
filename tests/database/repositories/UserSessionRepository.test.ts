import type { DrizzleDatabase } from "@database/DrizzleDatabase";
import { UserSessionRepository } from "@database/repositories/UserSessionRepository";
import { PersistenceError } from "@services/todoist/errors/PersistenceError";
import { UserSession, UserSessionStatus } from "@services/todoist/sessions/UserSession";

let sessionManager: UserSessionRepository;
let databaseMock: jest.Mocked<DrizzleDatabase>;
let connectionMock: any;

function createSelectChain(result: unknown): any {
  return {
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue(result),
      }),
    }),
  };
}

beforeEach(() => {
  connectionMock = {
    select: jest.fn(),
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockResolvedValue(undefined),
    }),
    delete: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(undefined),
    }),
  };

  databaseMock = {
    getConnection: jest.fn().mockReturnValue(connectionMock),
  } as any;

  sessionManager = new UserSessionRepository(databaseMock);
});

describe("UserSessionRepository", () => {
  describe("getSession", () => {
    it("should return a mapped session when found", async () => {
      // Arrange
      connectionMock.select.mockReturnValue(createSelectChain([
        {
          id: 1n,
          userId: 123n,
          status: "pending",
          oauthState: "oauth-state",
          accessToken: null,
          expiresAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]));

      // Act
      const result = await sessionManager.getSession("123");

      // Assert
      expect(result).toBeInstanceOf(UserSession);
      expect(result).toEqual(new UserSession(
        "123",
        UserSessionStatus.Pending,
        "oauth-state",
        null,
        new Date("2026-01-01T00:00:00.000Z"),
      ));
    });

    it("should return undefined when not found", async () => {
      // Arrange
      connectionMock.select.mockReturnValue(createSelectChain([]));

      // Act
      const result = await sessionManager.getSession("123");

      // Assert
      expect(result).toBeUndefined();
    });

    it("should throw PersistenceError for invalid userId format", async () => {
      // Act
      const result = sessionManager.getSession("not-a-number");

      // Assert
      await expect(result).rejects.toBeInstanceOf(PersistenceError);
    });
  });

  describe("getSessionByOAuthState", () => {
    it("should return a session mapped from database", async () => {
      // Arrange
      connectionMock.select.mockReturnValue(createSelectChain([
        {
          id: 1n,
          userId: 42n,
          status: "completed",
          oauthState: "oauth-state-2",
          accessToken: "token",
          expiresAt: null,
        },
      ]));

      // Act
      const result = await sessionManager.getSessionByOAuthState("oauth-state-2");

      // Assert
      expect(result).toEqual(new UserSession(
        "42",
        UserSessionStatus.Completed,
        "oauth-state-2",
        "token",
        null,
      ));
    });
  });

  describe("createSession", () => {
    it("should replace existing session by userId and insert the new one", async () => {
      // Arrange
      const session = new UserSession(
        "123",
        UserSessionStatus.Pending,
        "oauth-state",
        null,
        new Date("2026-01-01T00:00:00.000Z"),
      );

      // Act
      await sessionManager.createSession(session);

      // Assert
      expect(connectionMock.delete).toHaveBeenCalled();
      expect(connectionMock.insert).toHaveBeenCalled();
    });

    it("should wrap db errors in PersistenceError", async () => {
      // Arrange
      connectionMock.insert.mockReturnValue({
        values: jest.fn().mockRejectedValue(new Error("DB insert failed")),
      });
      const session = new UserSession(
        "123",
        UserSessionStatus.Pending,
        "oauth-state",
        null,
        null,
      );

      // Act
      const result = sessionManager.createSession(session);

      // Assert
      await expect(result).rejects.toBeInstanceOf(PersistenceError);
    });
  });

  describe("updateSession", () => {
    it("should replace session by userId", async () => {
      // Arrange
      const session = new UserSession(
        "999",
        UserSessionStatus.Completed,
        "new-state",
        "new-token",
        null,
      );

      // Act
      await sessionManager.updateSession(session);

      // Assert
      expect(connectionMock.delete).toHaveBeenCalled();
      expect(connectionMock.insert).toHaveBeenCalled();
    });

    it("should throw PersistenceError for db errors", async () => {
      // Arrange
      connectionMock.insert.mockReturnValue({
        values: jest.fn().mockRejectedValue(new Error("DB update failed")),
      });
      const session = new UserSession(
        "999",
        UserSessionStatus.Completed,
        "new-state",
        "new-token",
        null,
      );

      // Act
      const result = sessionManager.updateSession(session);

      // Assert
      await expect(result).rejects.toBeInstanceOf(PersistenceError);
    });
  });

  describe("deleteSession", () => {
    it("should delete by userId", async () => {
      // Act
      await sessionManager.deleteSession("123");
      // Assert
      expect(connectionMock.delete).toHaveBeenCalled();
    });

    it("should throw PersistenceError for db errors", async () => {
      // Arrange
      connectionMock.delete.mockReturnValue({
        where: jest.fn().mockRejectedValue(new Error("DB delete failed")),
      });

      // Act
      const result = sessionManager.deleteSession("123");

      // Assert
      await expect(result).rejects.toBeInstanceOf(PersistenceError);
    });
  });

  describe("pruneExpiredSessions", () => {
    it("should delete expired sessions", async () => {
      // Act
      await sessionManager.pruneExpiredSessions();

      // Assert
      expect(connectionMock.delete).toHaveBeenCalled();
    });

    it("should throw PersistenceError for db errors", async () => {
      // Arrange
      connectionMock.delete.mockReturnValue({
        where: jest.fn().mockRejectedValue(new Error("DB prune failed")),
      });

      // Act
      const result = sessionManager.pruneExpiredSessions();

      // Assert
      await expect(result).rejects.toBeInstanceOf(PersistenceError);
    });
  });
});
