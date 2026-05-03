import type { TranslationHandler } from "@bot/handlers/TranslationHandler";
import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type { ChatInputCommandInteraction, Locale } from "discord.js";
import { SubCommand } from "@bot/commands/SubCommand";
import { ApplicationCommandOptionType } from "discord.js";

class TestSubCommand extends SubCommand {
  protected readonly data = {
    name: "test-user",
    description: "A test subcommand for user-related actions.",
  };

  public async execute(
    _interaction: ChatInputCommandInteraction,
    _language: Locale,
  ): Promise<void> { /* empty body */ }
}

describe("SubCommand", () => {
  let mockedClient: Tickly;
  let command: TestSubCommand;

  beforeEach(() => {
    // Arrange
    const translationHandlerMock = {
      getDefaultLocale: jest.fn().mockReturnValue("en-US"),
      getCommandDescriptions: jest.fn().mockImplementation(() => {
        return {
          "en-US": "A test subcommand for user-related actions.",
          "es-ES": "Un subcomando de prueba para acciones relacionadas con el usuario.",
        };
      }),
    } as unknown as TranslationHandler;
    mockedClient = {
      getTranslationHandler: jest.fn().mockReturnValue(translationHandlerMock),
    } as unknown as Tickly;
    command = new TestSubCommand(
      mockedClient,
      {} as TodoistApiClient,
      {} as RepositoryFactory,
      "parentCommand",
    );
  });

  describe("Constructor", () => {
    it("should throw an error if parent command name is not provided", () => {
      // Act & Assert
      expect(() => new TestSubCommand(
        {} as Tickly,
        {} as TodoistApiClient,
        {} as RepositoryFactory,
        "",
      )).toThrow();
    });

    it("should init the parent command name", () => {
      // Act
      const result = command.getParentCommandName();

      // Assert
      expect(result).toBe("parentCommand");
    });
  });

  describe("getData", () => {
    it("should return the subcommand data with Subcommand type", () => {
      // Act
      const result = command.getData();
      // Assert
      expect(result.type).toBe(ApplicationCommandOptionType.Subcommand);
    });

    it("should return the subcommand data", () => {
      // Act
      const result = command.getData();
      // Assert
      expect(result.name).toBe("test-user");
      expect(result.description).toBe("A test subcommand for user-related actions.");
      expect(result.description_localizations).toEqual({
        "es-ES": "Un subcomando de prueba para acciones relacionadas con el usuario.",
      });
    });
  });

  describe("getTranslationCommandName", () => {
    it("should return the parent command name followed by the subcommand name", () => {
      // Act
      const result = (command as any).getTranslationCommandName();
      // Assert
      expect(result).toBe("parentCommand.test-user");
    });
  });

  describe("translate", () => {
    it("should look for the translation key in the parent command namespace", () => {
      // Arrange
      (command as any).getTranslationCommandName
        = jest.fn().mockReturnValue("parentCommand.test-user");
      const mockTranslateCommand
        = jest.fn().mockImplementation((language, command, key, _params) => {
          return language === "en-US"
            && command === "parentCommand.test-user" && key === "test-key"
            ? "translated string"
            : "default translation";
        });
      mockedClient.getTranslationHandler = jest.fn().mockReturnValue({
        translateCommand: mockTranslateCommand,
      });

      // Act
      const result = (command as any).translate("en-US", "test-key");

      // Assert
      expect(mockTranslateCommand).toHaveBeenCalled();
      expect(result).toBe("translated string");
    });
  });
});
