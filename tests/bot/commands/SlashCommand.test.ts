import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type {
  BaseInteraction,
  ChatInputCommandInteraction,
  Locale,
  LocalizationMap,
} from "discord.js";
import { SlashCommand } from "@bot/commands/SlashCommand";
import {
  ApplicationCommandType,
  ApplicationIntegrationType,
} from "discord.js";

class TestSlashCommand extends SlashCommand {
  protected readonly data = {
    name: "ping",
    integration_types: [ApplicationIntegrationType.GuildInstall],
  };

  public async execute(
    _interaction: ChatInputCommandInteraction,
    _language: Locale,
  ): Promise<void> { /* empty body */ }
}

describe("SlashCommand", () => {
  let descriptionsMock: LocalizationMap;
  let command: TestSlashCommand;

  beforeEach(() => {
    const translationHandlerMock = {
      getDefaultLocale: jest.fn().mockReturnValue("en-US"),
      getCommandDescriptions: jest.fn().mockImplementation(() => descriptionsMock),
    };
    const clientMock = {
      getTranslationHandler: jest.fn().mockReturnValue(translationHandlerMock),
    } as unknown as Tickly;

    // Arrange
    descriptionsMock = {};
    command = new TestSlashCommand(
      clientMock,
      {} as TodoistApiClient,
      {} as RepositoryFactory,
    );
  });

  it("should have the ChatInput type", () => {
    // Act
    const result = (command as any).type;
    // Assert
    expect(result).toBe(ApplicationCommandType.ChatInput);
  });

  describe("getData", () => {
    it("should return default and localized descriptions", () => {
      // Arrange
      descriptionsMock = {
        "en-US": "Displays the bot response time.",
        "fr": "Affiche le temps de réponse du bot.",
      };

      // Act
      const result = command.getData();

      // Assert
      expect(result).toEqual(expect.objectContaining({
        name: "ping",
        type: ApplicationCommandType.ChatInput,
        description: "Displays the bot response time.",
        description_localizations: {
          fr: "Affiche le temps de réponse du bot.",
        },
      }));
    });

    it("should omit description_localizations when only default locale exists", () => {
      // Arrange
      descriptionsMock = {
        "en-US": "Displays the bot response time.",
      };

      // Act
      const result = command.getData();

      // Assert
      expect(result.description).toBe("Displays the bot response time.");
      expect(result.description_localizations).toBeUndefined();
    });

    it("should keep an empty default description when it is missing", () => {
      // Arrange
      descriptionsMock = {
        fr: "Affiche le temps de réponse du bot.",
      };

      // Act
      const result = command.getData();

      // Assert
      expect(result.description).toBe("");
      expect(result.description_localizations).toEqual({
        fr: "Affiche le temps de réponse du bot.",
      });
    });
  });

  describe("getName", () => {
    it("should return command name", () => {
      // Act
      const result = command.getName();
      // Assert
      expect(result).toBe("ping");
    });
  });

  describe("hasUserPermission", () => {
    it("should return true when no user permissions are required", () => {
      // Arrange
      const interaction = {} as BaseInteraction;
      // Act
      const result = command.hasUserPermission(interaction);
      // Assert
      expect(result).toBe(true);
    });

    it("should return false when user permissions are required but missing", () => {
      // Arrange
      ((command as any).userRequiredPermissions as string[]).push("ManageMessages");
      const interaction = {
        memberPermissions: { has: jest.fn().mockReturnValue(false) },
      } as unknown as BaseInteraction;

      // Act
      const result = command.hasUserPermission(interaction);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe("hasBotPermission", () => {
    it("should return true when no bot permissions are required", () => {
      // Arrange
      const interaction = {
        appPermissions: { has: jest.fn() },
      } as unknown as BaseInteraction;

      // Act
      const result = command.hasBotPermission(interaction);

      // Assert
      expect(result).toBe(true);
    });

    it("should return false when bot permissions are required but missing", () => {
      // Arrange
      ((command as any).clientRequiredPermissions as string[]).push("ManageMessages");
      const interaction = {
        appPermissions: { has: jest.fn().mockReturnValue(false) },
      } as unknown as BaseInteraction;

      // Act
      const result = command.hasBotPermission(interaction);

      // Assert
      expect(result).toBe(false);
    });
  });
});
