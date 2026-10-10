import type { DrizzleDatabase } from "@database/DrizzleDatabase";
import type { AesGcmEncryptionService } from "@services/encryption/AesGcmEncryptionService";
import { UserSessionRepository } from "@database/repositories/UserSessionRepository";
import { EncryptionError } from "@services/encryption/EncryptionError";
import { PersistenceError } from "@services/todoist/errors/PersistenceError";
import { UserSession, UserSessionStatus } from "@services/todoist/sessions/UserSession";

const DEFAULT_RETENTION_DAYS = 30;

let sessionManager: UserSessionRepository;
let databaseMock: jest.Mocked<DrizzleDatabase>;
let encryptionServiceMock: jest.Mocked<AesGcmEncryptionService>;
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

function createSelectJoinChain(result: unknown): any {
  return {
    from: jest.fn().mockReturnValue({
      innerJoin: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(result),
      }),
    }),
  };
}

function createUpdateChain(): { set: jest.Mock } {
  const where = jest.fn().mockResolvedValue(undefined);
  const set = jest.fn().mockReturnValue({ where });
  return { set };
}

beforeEach(() => {
  connectionMock = {
    select: jest.fn().mockReturnValue(createSelectJoinChain([])),
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockResolvedValue(undefined),
    }),
    delete: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(undefined),
    }),
    update: jest.fn().mockReturnValue(createUpdateChain()),
  };

  databaseMock = {
    getConnection: jest.fn().mockReturnValue(connectionMock),
  } as any;

  encryptionServiceMock = {
    encrypt: jest.fn((plaintext: string) => `encrypted:${plaintext}`),
    decrypt: jest.fn((ciphertext: string) => ciphertext.replace("encrypted:", "")),
  } as any;

  sessionManager = new UserSessionRepository(databaseMock, DEFAULT_RETENTION_DAYS, encryptionServiceMock);
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
          lastUsedAt: new Date("2026-01-01T00:00:00.000Z"),
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

    it("should decrypt accessToken when reading session with token", async () => {
      // Arrange
      connectionMock.select.mockReturnValue(createSelectChain([
        {
          id: 1n,
          userId: 123n,
          status: "completed",
          oauthState: "oauth-state",
          accessToken: "encrypted:secret-token",
          expiresAt: null,
          lastUsedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]));

      // Act
      const result = await sessionManager.getSession("123");

      // Assert
      expect(encryptionServiceMock.decrypt).toHaveBeenCalledWith("encrypted:secret-token");
      expect(result?.accessToken).toBe("secret-token");
    });

    it("should return session with null accessToken when decryption fails", async () => {
      // Arrange
      connectionMock.select.mockReturnValue(createSelectChain([
        {
          id: 1n,
          userId: 123n,
          status: "completed",
          oauthState: "oauth-state",
          accessToken: "corrupted-token-data",
          expiresAt: null,
          lastUsedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]));
      encryptionServiceMock.decrypt.mockImplementation(() => {
        throw new EncryptionError("Decryption failed");
      });

      // Act
      const result = await sessionManager.getSession("123");

      // Assert
      expect(result).toBeInstanceOf(UserSession);
      expect(result?.status).toBe(UserSessionStatus.Completed);
      expect(result?.accessToken).toBeNull();
    });

    it("should rethrow non-EncryptionError errors during decryption", async () => {
      // Arrange
      connectionMock.select.mockReturnValue(createSelectChain([
        {
          id: 1n,
          userId: 123n,
          status: "completed",
          oauthState: "oauth-state",
          accessToken: "some-token",
          expiresAt: null,
          lastUsedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]));
      encryptionServiceMock.decrypt.mockImplementation(() => {
        throw new Error("Unexpected system error");
      });

      // Act & Assert
      await expect(sessionManager.getSession("123")).rejects.toThrow("Unexpected system error");
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
          accessToken: "encrypted:token",
          expiresAt: null,
          lastUsedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]));

      // Act
      const result = await sessionManager.getSessionByOAuthState("oauth-state-2");

      // Assert
      expect(encryptionServiceMock.decrypt).toHaveBeenCalledWith("encrypted:token");
      expect(result).toEqual(new UserSession(
        "42",
        UserSessionStatus.Completed,
        "oauth-state-2",
        "token",
        null,
      ));
    });

    it("should not decrypt null accessToken", async () => {
      // Arrange
      connectionMock.select.mockReturnValue(createSelectChain([
        {
          id: 1n,
          userId: 42n,
          status: "pending",
          oauthState: "oauth-state-3",
          accessToken: null,
          expiresAt: new Date("2026-01-01T00:00:00.000Z"),
          lastUsedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]));

      // Act
      const result = await sessionManager.getSessionByOAuthState("oauth-state-3");

      // Assert
      expect(encryptionServiceMock.decrypt).not.toHaveBeenCalled();
      expect(result?.accessToken).toBeNull();
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

    it("should set lastUsedAt on the inserted entity", async () => {
      // Arrange
      const session = new UserSession(
        "123",
        UserSessionStatus.Pending,
        "oauth-state",
        null,
        null,
      );
      const insertValues = connectionMock.insert().values as jest.Mock;
      connectionMock.insert.mockReturnValue({ values: insertValues });

      // Act
      await sessionManager.createSession(session);

      // Assert
      expect(insertValues).toHaveBeenCalledWith(
        expect.objectContaining({ lastUsedAt: expect.any(Date) }),
      );
    });

    it("should encrypt accessToken when creating session with token", async () => {
      // Arrange
      const session = new UserSession(
        "123",
        UserSessionStatus.Completed,
        "oauth-state",
        "my-secret-token",
        null,
      );
      const insertValues = connectionMock.insert().values as jest.Mock;
      connectionMock.insert.mockReturnValue({ values: insertValues });

      // Act
      await sessionManager.createSession(session);

      // Assert
      expect(encryptionServiceMock.encrypt).toHaveBeenCalledWith("my-secret-token");
      expect(insertValues).toHaveBeenCalledWith(
        expect.objectContaining({ accessToken: "encrypted:my-secret-token" }),
      );
    });

    it("should not encrypt null accessToken", async () => {
      // Arrange
      const session = new UserSession(
        "123",
        UserSessionStatus.Pending,
        "oauth-state",
        null,
        null,
      );
      const insertValues = connectionMock.insert().values as jest.Mock;
      connectionMock.insert.mockReturnValue({ values: insertValues });

      // Act
      await sessionManager.createSession(session);

      // Assert
      expect(encryptionServiceMock.encrypt).not.toHaveBeenCalled();
      expect(insertValues).toHaveBeenCalledWith(
        expect.objectContaining({ accessToken: null }),
      );
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

    it("should encrypt accessToken when updating session with token", async () => {
      // Arrange
      const session = new UserSession(
        "999",
        UserSessionStatus.Completed,
        "new-state",
        "updated-token",
        null,
      );
      const insertValues = connectionMock.insert().values as jest.Mock;
      connectionMock.insert.mockReturnValue({ values: insertValues });

      // Act
      await sessionManager.updateSession(session);

      // Assert
      expect(encryptionServiceMock.encrypt).toHaveBeenCalledWith("updated-token");
      expect(insertValues).toHaveBeenCalledWith(
        expect.objectContaining({ accessToken: "encrypted:updated-token" }),
      );
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

    it("should use the provided executor when given", async () => {
      // Arrange
      const executorDeleteChain = { where: jest.fn().mockResolvedValue(undefined) };
      const executor = { delete: jest.fn().mockReturnValue(executorDeleteChain) };

      // Act
      await sessionManager.deleteSession("123", executor as any);

      // Assert
      expect(executor.delete).toHaveBeenCalled();
      expect(connectionMock.delete).not.toHaveBeenCalled();
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

  describe("touchSession", () => {
    it("should update last_used_at for the given userId", async () => {
      // Arrange
      const updateChain = createUpdateChain();
      connectionMock.update.mockReturnValue(updateChain);

      // Act
      await sessionManager.touchSession("123");

      // Assert
      expect(connectionMock.update).toHaveBeenCalled();
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ lastUsedAt: expect.any(Date) }),
      );
    });

    it("should throw PersistenceError for invalid userId format", async () => {
      // Act
      const result = sessionManager.touchSession("not-a-number");

      // Assert
      await expect(result).rejects.toBeInstanceOf(PersistenceError);
    });

    it("should throw PersistenceError for db errors", async () => {
      // Arrange
      connectionMock.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockRejectedValue(new Error("DB update failed")),
        }),
      });

      // Act
      const result = sessionManager.touchSession("123");

      // Assert
      await expect(result).rejects.toBeInstanceOf(PersistenceError);
    });
  });

  describe("pruneExpiredSessions", () => {
    it("should prune expired OAuth sessions", async () => {
      // Act
      await sessionManager.pruneExpiredSessions();

      // Assert
      expect(connectionMock.delete).toHaveBeenCalled();
    });

    it("should query inactive completed sessions joined with users", async () => {
      // Act
      await sessionManager.pruneExpiredSessions();

      // Assert
      expect(connectionMock.select).toHaveBeenCalled();
    });

    it("should delete inactive sessions when found", async () => {
      // Arrange
      const expiredLastUsedAt = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      connectionMock.select.mockReturnValue(
        createSelectJoinChain([
          { userId: 42n, lastUsedAt: expiredLastUsedAt, retentionDays: null },
        ]),
      );

      // Act
      await sessionManager.pruneExpiredSessions();

      // Assert
      expect(connectionMock.delete).toHaveBeenCalledTimes(2);
    });

    it("should not issue a second delete when no sessions are inactive", async () => {
      // Arrange
      const recentLastUsedAt = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
      connectionMock.select.mockReturnValue(
        createSelectJoinChain([
          { userId: 42n, lastUsedAt: recentLastUsedAt, retentionDays: null },
        ]),
      );

      // Act
      await sessionManager.pruneExpiredSessions();

      // Assert
      expect(connectionMock.delete).toHaveBeenCalledTimes(1);
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
