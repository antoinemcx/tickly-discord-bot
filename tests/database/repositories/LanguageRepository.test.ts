import type { DrizzleDatabase } from "@database/DrizzleDatabase";
import { LanguageRepository } from "@database/repositories/LanguageRepository";
import { DrizzleError } from "drizzle-orm";

let repository: LanguageRepository;
let databaseMock: jest.Mocked<DrizzleDatabase>;
let connectionMock: any;

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

  repository = new LanguageRepository(databaseMock);
});

describe("LanguageRepository", () => {
  describe("getLanguageCodes", () => {
    it("should return all language codes", async () => {
      // Arrange
      const expectedLanguages = ["en", "fr"];
      connectionMock.select.mockReturnValue({
        from: jest.fn().mockReturnValue(
          expectedLanguages.map(code => ({ code })),
        ),
      });

      // Act
      const result = await repository.getLanguageCodes();

      // Assert
      expect(result).toEqual(expectedLanguages);
    });

    it("should return empty array when not found", async () => {
      // Arrange
      connectionMock.select.mockReturnValue({
        from: jest.fn().mockReturnValue([]),
      });

      // Act
      const result = await repository.getLanguageCodes();

      // Assert
      expect(result).toStrictEqual([]);
    });

    it("should throw an error in case of SQL errors", async () => {
      // Arrange
      connectionMock.select.mockReturnValue({
        from: jest.fn().mockRejectedValue(new DrizzleError({
          message: "Table not found",
        })),
      });
      // Act & Assert
      await expect(repository.getLanguageCodes()).rejects.toThrow(Error);
    });
  });
});
