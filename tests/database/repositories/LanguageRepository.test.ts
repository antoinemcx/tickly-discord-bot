import type { DrizzleDatabase } from "@database/DrizzleDatabase";
import type { Language } from "@database/schema/user.schema";
import { LanguageRepository } from "@database/repositories/LanguageRepository";
import { Locale } from "discord.js";

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
  });

  describe("addLanguage", () => {
    it("should insert or update a language using the default connection", async () => {
      // Arrange
      const language: Language = {
        id: 1,
        code: Locale.EnglishUS,
        name: "English",
      };
      const onDuplicateKeyUpdateMock = jest.fn().mockResolvedValue(undefined);
      const valuesMock = jest.fn().mockReturnValue({
        onDuplicateKeyUpdate: onDuplicateKeyUpdateMock,
      });
      connectionMock.insert.mockReturnValue({ values: valuesMock });

      // Act
      await repository.addLanguage(language);

      // Assert
      expect(connectionMock.insert).toHaveBeenCalledTimes(1);
      expect(valuesMock).toHaveBeenCalledWith(language);
      expect(onDuplicateKeyUpdateMock).toHaveBeenCalledWith({
        set: {
          code: language.code,
          name: language.name,
        },
      });
    });

    it("should use the injected insert executor when provided", async () => {
      // Arrange
      const language: Language = {
        id: 2,
        code: Locale.French,
        name: "French",
      };
      const onDuplicateKeyUpdateMock = jest.fn().mockResolvedValue(undefined);
      const valuesMock = jest.fn().mockReturnValue({
        onDuplicateKeyUpdate: onDuplicateKeyUpdateMock,
      });
      const insertExecutor = {
        insert: jest.fn().mockReturnValue({
          values: valuesMock,
        }),
      } as any;

      // Act
      await repository.addLanguage(language, insertExecutor);

      // Assert
      expect(insertExecutor.insert).toHaveBeenCalledTimes(1);
      expect(valuesMock).toHaveBeenCalledWith(language);
      expect(onDuplicateKeyUpdateMock).toHaveBeenCalledWith({
        set: {
          code: language.code,
          name: language.name,
        },
      });
    });
  });
});
