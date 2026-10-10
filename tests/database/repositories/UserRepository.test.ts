import type { DrizzleDatabase } from "@database/DrizzleDatabase";
import { UserRepository } from "@database/repositories/UserRepository";
import { Locale } from "discord.js";

let repository: UserRepository;
let databaseMock: jest.Mocked<DrizzleDatabase>;
let connectionMock: any;

function createSelectChain(result: unknown): any {
  return {
    from: jest.fn().mockReturnValue({
      innerJoin: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(result),
        }),
      }),
    }),
  };
}

function createSelectWhereChain(result: unknown): any {
  return {
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue(result),
      }),
    }),
  };
}

function createSelectLeftJoinChain(result: unknown): any {
  return {
    from: jest.fn().mockReturnValue({
      leftJoin: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(result),
        }),
      }),
    }),
  };
}

function createUpdateChain(): { set: jest.Mock; where: jest.Mock } {
  const where = jest.fn().mockResolvedValue(undefined);
  const set = jest.fn().mockReturnValue({ where });
  return { set, where };
}

function createInsertChain(): { values: jest.Mock; onDuplicateKeyUpdate: jest.Mock } {
  const onDuplicateKeyUpdate = jest.fn().mockResolvedValue(undefined);
  const values = jest.fn().mockReturnValue({ onDuplicateKeyUpdate });
  return { values, onDuplicateKeyUpdate };
}

beforeEach(() => {
  connectionMock = {
    select: jest.fn(),
    update: jest.fn(),
    insert: jest.fn(),
  };

  databaseMock = {
    getConnection: jest.fn().mockReturnValue(connectionMock),
  } as any;

  repository = new UserRepository(databaseMock);
});

describe("UserRepository", () => {
  describe("getUserPreferences", () => {
    it("should return language and retention when both are set", async () => {
      // Arrange
      connectionMock.select.mockReturnValue(createSelectLeftJoinChain([{
        languageId: 1,
        languageCode: Locale.French,
        languageName: "French",
        sessionRetentionDays: 90,
      }]));

      // Act
      const result = await repository.getUserPreferences("123");

      // Assert
      expect(result.language).toEqual({ id: 1, code: Locale.French, name: "French" });
      expect(result.sessionRetentionDays).toBe(90);
    });

    it("should return undefined language when no language is set", async () => {
      // Arrange
      connectionMock.select.mockReturnValue(createSelectLeftJoinChain([{
        languageId: null,
        languageCode: null,
        languageName: null,
        sessionRetentionDays: null,
      }]));

      // Act
      const result = await repository.getUserPreferences("123");

      // Assert
      expect(result.language).toBeUndefined();
      expect(result.sessionRetentionDays).toBeNull();
    });

    it("should return defaults when the user does not exist", async () => {
      // Arrange
      connectionMock.select.mockReturnValue(createSelectLeftJoinChain([]));

      // Act
      const result = await repository.getUserPreferences("123");

      // Assert
      expect(result.language).toBeUndefined();
      expect(result.sessionRetentionDays).toBeNull();
    });
  });

  describe("getUserPreferredLanguage", () => {
    it("should return the preferred language when one is configured", async () => {
      // Arrange
      connectionMock.select.mockReturnValue(createSelectChain([
        {
          id: 1,
          code: Locale.French,
          name: "French",
        },
      ]));

      // Act
      const result = await repository.getUserPreferredLanguage("123");

      // Assert
      expect(result).toEqual({
        id: 1,
        code: Locale.French,
        name: "French",
      });
    });

    it("should return undefined when no preferred language is configured", async () => {
      // Arrange
      connectionMock.select.mockReturnValue(createSelectChain([]));

      // Act
      const result = await repository.getUserPreferredLanguage("123");

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe("setUserPreferredLanguage", () => {
    it("should set preferred language to null without creating the user", async () => {
      // Arrange
      const updateChain = createUpdateChain();
      connectionMock.update = jest.fn().mockReturnValue(updateChain);

      // Act
      await repository.setUserPreferredLanguage("123", null);

      // Assert
      expect(connectionMock.insert).not.toHaveBeenCalled();
      expect(updateChain.set).toHaveBeenCalledWith({ preferredLanguageId: null });
    });

    it("should ensure user exists then set preferred language by numeric ID", async () => {
      // Arrange
      const insertChain = createInsertChain();
      connectionMock.insert = jest.fn().mockReturnValue(insertChain);
      const updateChain = createUpdateChain();
      connectionMock.update = jest.fn().mockReturnValue(updateChain);

      // Act
      await repository.setUserPreferredLanguage("123", 2);

      // Assert
      expect(connectionMock.insert).toHaveBeenCalled();
      expect(insertChain.values).toHaveBeenCalledWith({ id: BigInt("123") });
      expect(updateChain.set).toHaveBeenCalledWith({ preferredLanguageId: 2 });
    });

    it("should ensure user exists then set preferred language by locale", async () => {
      // Arrange
      connectionMock.select.mockReturnValue(createSelectWhereChain([{ id: 3 }]));
      const insertChain = createInsertChain();
      connectionMock.insert = jest.fn().mockReturnValue(insertChain);
      const updateChain = createUpdateChain();
      connectionMock.update = jest.fn().mockReturnValue(updateChain);

      // Act
      await repository.setUserPreferredLanguage("123", Locale.French);

      // Assert
      expect(connectionMock.select).toHaveBeenCalled();
      expect(connectionMock.insert).toHaveBeenCalled();
      expect(insertChain.values).toHaveBeenCalledWith({ id: BigInt("123") });
      expect(updateChain.set).toHaveBeenCalledWith({ preferredLanguageId: 3 });
    });

    it("should throw when locale does not match any stored language", async () => {
      // Arrange
      connectionMock.select.mockReturnValue(createSelectWhereChain([]));

      // Act & Assert
      await expect(
        repository.setUserPreferredLanguage("123", Locale.French),
      ).rejects.toThrow("Language not found for locale: fr");
    });
  });

  describe("getUserSessionRetentionDays", () => {
    it("should return the configured retention days when set", async () => {
      // Arrange
      connectionMock.select.mockReturnValue(createSelectWhereChain([
        { sessionRetentionDays: 90 },
      ]));

      // Act
      const result = await repository.getUserSessionRetentionDays("123");

      // Assert
      expect(result).toBe(90);
    });

    it("should return null when no preference is set", async () => {
      // Arrange
      connectionMock.select.mockReturnValue(createSelectWhereChain([
        { sessionRetentionDays: null },
      ]));

      // Act
      const result = await repository.getUserSessionRetentionDays("123");

      // Assert
      expect(result).toBeNull();
    });

    it("should return null when user does not exist", async () => {
      // Arrange
      connectionMock.select.mockReturnValue(createSelectWhereChain([]));

      // Act
      const result = await repository.getUserSessionRetentionDays("123");

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("setUserSessionRetentionDays", () => {
    it("should ensure user exists then set retention days", async () => {
      // Arrange
      const insertChain = createInsertChain();
      connectionMock.insert = jest.fn().mockReturnValue(insertChain);
      const updateChain = createUpdateChain();
      connectionMock.update = jest.fn().mockReturnValue(updateChain);

      // Act
      await repository.setUserSessionRetentionDays("123", 90);

      // Assert
      expect(connectionMock.insert).toHaveBeenCalled();
      expect(insertChain.values).toHaveBeenCalledWith({ id: BigInt("123") });
      expect(updateChain.set).toHaveBeenCalledWith({ sessionRetentionDays: 90 });
    });

    it("should set retention days to null without creating the user", async () => {
      // Arrange
      const updateChain = createUpdateChain();
      connectionMock.update = jest.fn().mockReturnValue(updateChain);

      // Act
      await repository.setUserSessionRetentionDays("123", null);

      // Assert
      expect(connectionMock.insert).not.toHaveBeenCalled();
      expect(updateChain.set).toHaveBeenCalledWith({ sessionRetentionDays: null });
    });
  });

  describe("deleteUser", () => {
    it("should delete the user row by ID", async () => {
      // Arrange
      const deleteChain = { where: jest.fn().mockResolvedValue(undefined) };
      connectionMock.delete = jest.fn().mockReturnValue(deleteChain);

      // Act
      await repository.deleteUser("123");

      // Assert
      expect(connectionMock.delete).toHaveBeenCalled();
      expect(deleteChain.where).toHaveBeenCalled();
    });

    it("should use the provided executor when given", async () => {
      // Arrange
      const executorDeleteChain = { where: jest.fn().mockResolvedValue(undefined) };
      const executor = { delete: jest.fn().mockReturnValue(executorDeleteChain) };
      connectionMock.delete = jest.fn();

      // Act
      await repository.deleteUser("123", executor as any);

      // Assert
      expect(executor.delete).toHaveBeenCalled();
      expect(connectionMock.delete).not.toHaveBeenCalled();
    });
  });

  describe("deleteAllUserData", () => {
    it("should delete session and user data within a transaction", async () => {
      // Arrange
      const deleteChain = { where: jest.fn().mockResolvedValue(undefined) };
      const txMock = { delete: jest.fn().mockReturnValue(deleteChain) };
      connectionMock.transaction = jest.fn().mockImplementation(async cb => cb(txMock));

      const sessionDeleteMock = jest.fn().mockResolvedValue(undefined);
      const repositoriesMock = {
        getUserSessionRepository: () => ({ deleteSession: sessionDeleteMock }),
      } as any;

      // Act
      await repository.deleteAllUserData("123", repositoriesMock);

      // Assert
      expect(connectionMock.transaction).toHaveBeenCalled();
      expect(sessionDeleteMock).toHaveBeenCalledWith("123", txMock);
      expect(txMock.delete).toHaveBeenCalled();
    });

    it("should call session deletion before user deletion", async () => {
      // Arrange
      const callOrder: string[] = [];
      const deleteChain = {
        where: jest.fn().mockImplementation(() => {
          callOrder.push("user");
          return Promise.resolve();
        }),
      };
      const txMock = { delete: jest.fn().mockReturnValue(deleteChain) };
      connectionMock.transaction = jest.fn().mockImplementation(async cb => cb(txMock));

      const sessionDeleteMock = jest.fn().mockImplementation(() => {
        callOrder.push("session");
        return Promise.resolve();
      });
      const repositoriesMock = {
        getUserSessionRepository: () => ({ deleteSession: sessionDeleteMock }),
      } as any;

      // Act
      await repository.deleteAllUserData("123", repositoriesMock);

      // Assert
      expect(callOrder).toEqual(["session", "user"]);
    });
  });
});
