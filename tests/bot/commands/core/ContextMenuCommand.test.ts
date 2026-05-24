import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type { MessageContextMenuCommandInteraction } from "discord.js";
import { ContextMenuCommand } from "@bot/commands/core/ContextMenuCommand";
import { ApplicationCommandType, ApplicationIntegrationType, Locale } from "discord.js";

class TestContextMenuCommand extends ContextMenuCommand {
  protected readonly type = ApplicationCommandType.Message;
  protected readonly translationName = "test-context-menu";
  protected readonly data = {
    integration_types: [ApplicationIntegrationType.GuildInstall],
  };

  public async execute(
    _interaction: MessageContextMenuCommandInteraction,
    _language: Locale,
  ): Promise<void> { /* empty body */ }
}

describe("ContextMenuCommand", () => {
  let command: TestContextMenuCommand;

  beforeEach(() => {
    // Arrange
    const clientMock = {
      getTranslationHandler: () => ({
        getDefaultLocale: () => Locale.EnglishUS,
        translateCommand: jest.fn().mockReturnValue("Test Command"),
        getCommandNames: jest.fn().mockReturnValue({
          [Locale.EnglishUS]: "Test Context Menu Command",
        }),
      }),
    } as unknown as Tickly;
    command = new TestContextMenuCommand(
      clientMock,
      {} as TodoistApiClient,
      {} as RepositoryFactory,
    );
  });

  it("should not include description fields in command data", () => {
    // Act
    const result = command.getData();

    // Assert
    expect(result.description).toBeUndefined();
    expect((result as any).description_localizations).toBeUndefined();
  });

  describe("getName", () => {
    it("should return the translation name", () => {
      // Act
      const result = command.getName();

      // Assert
      expect(result).toBe("test-context-menu");
    });
  });

  describe("getData", () => {
    it("should return the command type and integration types", () => {
      // Act
      const result = command.getData();

      // Assert
      expect(result.type).toBe(ApplicationCommandType.Message);
      expect(result.integration_types).toEqual([ApplicationIntegrationType.GuildInstall]);
    });

    it("should throw if no translation is found for the command name in the default locale", () => {
      // Arrange
      const clientMock = {
        getTranslationHandler: () => ({
          getDefaultLocale: () => Locale.EnglishUS,
          translateCommand: jest.fn().mockReturnValue(undefined),
          getCommandNames: jest.fn().mockReturnValue({}),
        }),
      } as unknown as Tickly;
      command = new TestContextMenuCommand(
        clientMock,
        {} as TodoistApiClient,
        {} as RepositoryFactory,
      );

      // Act & Assert
      expect(() => command.getData()).toThrow();
    });

    it("should set the command name to the default locale translation", () => {
      // Act
      const result = command.getData();

      // Assert
      expect(result.name).toBe("Test Context Menu Command");
    });

    it("should set the command name localizations to the translations for other locales", () => {
      // Arrange
      const clientMock = {
        getTranslationHandler: () => ({
          getDefaultLocale: () => Locale.EnglishUS,
          getCommandNames: jest.fn().mockReturnValue({
            [Locale.EnglishUS]: "Test Context Menu Command",
            [Locale.French]: "Commande de Test",
          }),
        }),
      } as unknown as Tickly;
      command = new TestContextMenuCommand(
        clientMock,
        {} as TodoistApiClient,
        {} as RepositoryFactory,
      );

      // Act
      const result = command.getData();

      // Assert
      expect(result.name).toBe("Test Context Menu Command");
      expect(result.name_localizations).toEqual({
        [Locale.French]: "Commande de Test",
      });
    });
  });
});
