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
});
