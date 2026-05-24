import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type {
  APIApplicationCommandOption,
  BaseInteraction,
  ChatInputCommandInteraction,
  Locale,
  LocalizationMap,
} from "discord.js";
import { SlashCommand, SlashCommandCategory } from "@bot/commands/core/SlashCommand";
import { SubCommand } from "@bot/commands/core/SubCommand";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ApplicationIntegrationType,
} from "discord.js";

class TestSlashCommand extends SlashCommand {
  readonly category = SlashCommandCategory.Todoist;
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
  let clientMock: Tickly;
  let translateCommandMock: jest.Mock;

  beforeEach(() => {
    const translationHandlerMock = {
      getDefaultLocale: jest.fn().mockReturnValue("en-US"),
      getCommandDescriptions: jest.fn().mockImplementation(() => descriptionsMock),
      getLocales: jest.fn().mockReturnValue(["en-US", "fr"]),
      translateCommand: jest.fn().mockImplementation(
        (_locale: Locale, _command: string, translationKey: string) => {
          if (translationKey === "options.command.description") {
            return "Get help for a specific command.";
          }

          return "Missing translation for " + translationKey;
        },
      ),
    };
    translateCommandMock = translationHandlerMock.translateCommand;
    clientMock = {
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

    it("should sort options by required ones first", () => {
      // Arrange
      const optionalOption: APIApplicationCommandOption = {
        name: "toBeChanged",
        type: ApplicationCommandOptionType.String,
        description: ":D",
        required: false,
      };
      const requiredOption = { ...optionalOption, required: true };
      const options: APIApplicationCommandOption[] = [
        { ...optionalOption, name: "optional1" },
        { ...requiredOption, name: "required1" },
        { ...optionalOption, name: "optional2" },
        { ...requiredOption, name: "required2" },
      ];
      (command as any).data.options = options;

      // Act
      const result = command.getData();

      // Assert
      expect(result.options).toEqual([
        { ...requiredOption, name: "required1" },
        { ...requiredOption, name: "required2" },
        { ...optionalOption, name: "optional1" },
        { ...optionalOption, name: "optional2" },
      ]);
    });

    it("should translate option descriptions from commands.json", () => {
      // Arrange
      (command as any).data.options = [{
        name: "command",
        type: ApplicationCommandOptionType.String,
        required: false,
      }];

      // Act
      const result = command.getData();

      // Assert
      expect(translateCommandMock).toHaveBeenCalledWith(
        "en-US",
        "ping",
        "options.command.description",
      );
      expect(result.options).toEqual([
        expect.objectContaining({
          name: "command",
          description: "Get help for a specific command.",
        }),
      ]);
    });

    it("should include subcommands first when present", () => {
      // Arrange
      const todoistClientMock = {} as TodoistApiClient;
      const repositoriesMock = {} as RepositoryFactory;
      class DummySub extends SubCommand {
        protected readonly data = {
          name: "sub",
          description: "A subcommand",
        };

        getData() {
          return { name: "sub", type: 1, description: "", options: [] };
        }

        public async execute(
          _interaction: ChatInputCommandInteraction,
          _language: Locale,
        ): Promise<void> { /* empty body */ }
      }
      const sub
        = new DummySub(clientMock, todoistClientMock, repositoriesMock, "parent");
      (command as any).subcommands = [sub];
      (command as any).data.options = [
        { name: "opt", type: 3, description: "", required: false },
      ];

      // Act
      const result = command.getData();

      // Assert
      expect(result.options?.[0].name).toBe("sub");
      expect(result.options?.[1].name).toBe("opt");
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

  describe("getSubCommands", () => {
    it("should return a copy of the subcommands array", () => {
      // Arrange
      const subCommand1 = {} as SubCommand;
      const subCommand2 = {} as SubCommand;
      (command as any).subcommands = [subCommand1, subCommand2];

      // Act
      const result = command.getSubCommands();

      // Assert
      expect(result).toEqual([subCommand1, subCommand2]);
      expect(result).not.toBe((command as any).subcommands);
    });

    it("should return an empty array if no subcommands are defined", () => {
      // Arrange
      (command as any).subcommands = undefined;
      // Act
      const result = command.getSubCommands();
      // Assert
      expect(result).toEqual([]);
    });
  });
});
