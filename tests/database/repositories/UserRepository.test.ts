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

beforeEach(() => {
  connectionMock = {
    select: jest.fn(),
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
});
