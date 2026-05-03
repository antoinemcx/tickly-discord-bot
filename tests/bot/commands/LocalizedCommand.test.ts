import type { CommandData, SubCommandData } from "@bot/commands/BaseCommand";
import type { TranslationHandler } from "@bot/handlers/TranslationHandler";
import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type {
  APIApplicationCommand,
  APIApplicationCommandOption,
  ChatInputCommandInteraction,
  LocalizationMap,
} from "discord.js";
import { LocalizedCommand } from "@bot/commands/LocalizedCommand";
import { SubCommand } from "@bot/commands/SubCommand";
import {
  ApplicationCommandOptionType,
  ApplicationIntegrationType,
  Locale,
} from "discord.js";

class TestLocalized extends LocalizedCommand {
  protected readonly type = ApplicationCommandOptionType.String as any;
  protected readonly data = {
    name: "test",
    integration_types: [ApplicationIntegrationType.GuildInstall],
  };

  public async execute(
    _interaction: ChatInputCommandInteraction,
    _language: Locale,
  ): Promise<void> { /* noop */ }

  public getData(): (CommandData & { type: APIApplicationCommand["type"] }) {
    return {} as (CommandData & { type: APIApplicationCommand["type"] });
  }
}

describe("LocalizedCommand", () => {
  const defaultLocale: Locale = Locale.EnglishUS;
  let descriptionsMock: LocalizationMap;
  let clientMock: Tickly;
  let translationHandlerMock: TranslationHandler;
  let command: TestLocalized;

  beforeEach(() => {
    translationHandlerMock = {
      getDefaultLocale: jest.fn().mockReturnValue(defaultLocale),
      getCommandDescriptions: jest.fn().mockImplementation(() => descriptionsMock),
    } as unknown as TranslationHandler;
    clientMock = {
      getTranslationHandler: jest.fn().mockReturnValue(translationHandlerMock),
    } as unknown as Tickly;

    // Arrange
    descriptionsMock = {};
    command = new TestLocalized(
      clientMock,
      {} as TodoistApiClient,
      {} as RepositoryFactory,
    );
  });
  describe("buildDescriptionFields", () => {
    it("should return default and localized descriptions", () => {
      // Arrange
      descriptionsMock = {
        "en-US": "Displays the bot response time.",
        "fr": "Affiche le temps de réponse du bot.",
      };

      // Act
      const result = (command as any).buildDescriptionFields();

      // Assert
      expect(translationHandlerMock.getCommandDescriptions)
        .toHaveBeenCalledWith("test");
      expect(result.description).toBe("Displays the bot response time.");
      expect(result.description_localizations).toEqual({
        fr: "Affiche le temps de réponse du bot.",
      });
    });

    it("should omit description_localizations when only default locale exists", () => {
      // Arrange
      descriptionsMock = {
        "en-US": "Displays the bot response time.",
      };

      // Act
      const result = (command as any).buildDescriptionFields();

      // Assert
      expect(translationHandlerMock.getCommandDescriptions)
        .toHaveBeenCalledWith("test");
      expect(result.description).toBe("Displays the bot response time.");
      expect(result.description_localizations).toBeUndefined();
    });

    it("should fetch descriptions with the correct key for subcommands", () => {
      // Arrange
      const subCommand = new (class extends SubCommand {
        protected readonly type = ApplicationCommandOptionType.String as any;
        protected readonly data = { name: "sub", description: "" };

        public async execute(
          _interaction: ChatInputCommandInteraction,
          _language: Locale,
        ): Promise<void> { /* noop */ }

        public getData():
        (SubCommandData & { type: ApplicationCommandOptionType.Subcommand }) {
          return {} as (SubCommandData & {
            type: ApplicationCommandOptionType.Subcommand;
          });
        }
      })(clientMock, {} as TodoistApiClient, {} as RepositoryFactory, "parent");

      // Act
      const _result = (subCommand as any).buildDescriptionFields();

      // Assert
      expect(translationHandlerMock.getCommandDescriptions)
        .toHaveBeenCalledWith("parent.sub");
    });

    it("should keep an empty default description when it is missing", () => {
      // Arrange
      descriptionsMock = {
        fr: "Affiche le temps de réponse du bot.",
      };

      // Act
      const result = (command as any).buildDescriptionFields();

      // Assert
      expect(result.description).toBe("");
      expect(result.description_localizations).toEqual({
        fr: "Affiche le temps de réponse du bot.",
      });
    });
  });

  describe("sortOptionsByRequired", () => {
    const optionalOption: APIApplicationCommandOption = {
      name: "toBeChanged",
      type: ApplicationCommandOptionType.String,
      description: ":D",
      required: false,
    };
    const requiredOption = { ...optionalOption, required: true };

    it("should order required options first", () => {
      // Arrange
      descriptionsMock = {
        "en-US": "test",
      };
      const options: APIApplicationCommandOption[] = [
        { ...optionalOption, name: "optional1" },
        { ...requiredOption, name: "required1" },
        { ...optionalOption, name: "optional2" },
        { ...requiredOption, name: "required2" },
      ];

      // Act
      const result = (command as any).sortOptionsByRequired(options);

      // Assert
      expect(result).toEqual([
        { ...requiredOption, name: "required1" },
        { ...requiredOption, name: "required2" },
        { ...optionalOption, name: "optional1" },
        { ...optionalOption, name: "optional2" },
      ]);
    });

    it("should return undefined if options is undefined", () => {
      // Act
      const result = (command as any).sortOptionsByRequired(undefined);

      // Assert
      expect(result).toBeUndefined();
    });
  });
});
