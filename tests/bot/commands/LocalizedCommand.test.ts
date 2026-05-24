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
  let namesMock: LocalizationMap;
  let clientMock: Tickly;
  let translationHandlerMock: TranslationHandler;
  let command: TestLocalized;

  beforeEach(() => {
    translationHandlerMock = {
      getDefaultLocale: jest.fn().mockReturnValue(defaultLocale),
      getCommandDescriptions: jest.fn().mockImplementation(() => descriptionsMock),
      getCommandNames: jest.fn().mockImplementation(() => namesMock),
    } as unknown as TranslationHandler;
    clientMock = {
      getTranslationHandler: jest.fn().mockReturnValue(translationHandlerMock),
    } as unknown as Tickly;

    // Arrange
    descriptionsMock = {};
    namesMock = {};
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

  describe("buildNameFields", () => {
    it("should return default and localized names", () => {
      // Arrange
      namesMock = {
        "en-US": "ping",
        "fr": "ping-fr",
      };

      // Act
      const result = (command as any).buildNameFields();

      // Assert
      expect(translationHandlerMock.getCommandNames)
        .toHaveBeenCalledWith("test");
      expect(result.name).toBe("ping");
      expect(result.name_localizations).toEqual({
        fr: "ping-fr",
      });
    });

    it("should omit name_localizations when only default locale exists", () => {
      // Arrange
      namesMock = {
        "en-US": "ping",
      };

      // Act
      const result = (command as any).buildNameFields();

      // Assert
      expect(translationHandlerMock.getCommandNames)
        .toHaveBeenCalledWith("test");
      expect(result.name).toBe("ping");
      expect(result.name_localizations).toBeUndefined();
    });

    it("should fetch names with the correct key for subcommands", () => {
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
      const _result = (subCommand as any).buildNameFields();

      // Assert
      expect(translationHandlerMock.getCommandNames)
        .toHaveBeenCalledWith("parent.sub");
    });

    it("should keep an empty default name when it is missing", () => {
      // Arrange
      namesMock = {
        fr: "ping-fr",
      };

      // Act
      const result = (command as any).buildNameFields();

      // Assert
      expect(result.name).toBe("");
      expect(result.name_localizations).toEqual({
        fr: "ping-fr",
      });
    });
  });

  describe("buildOptionDescriptionFields", () => {
    it("should return default and localized option descriptions", () => {
      // Arrange
      const locales: Locale[] = [defaultLocale, "fr" as Locale];
      translationHandlerMock.getLocales = jest.fn().mockReturnValue(locales);
      translationHandlerMock.translateCommand = jest.fn().mockImplementation(
        (locale: Locale, commandName: string, translationKey: string) => {
          if (commandName !== "test" || translationKey !== "options.command.description") {
            return "Missing translation for " + translationKey;
          }

          if (locale === defaultLocale) {
            return "Get help for a specific command.";
          }

          if (locale === "fr") {
            return "Obtenir de l'aide pour une commande précise.";
          }

          return "Missing translation for " + translationKey;
        },
      );

      // Act
      const result = (command as any).buildOptionDescriptionFields("command");

      // Assert
      expect(translationHandlerMock.translateCommand).toHaveBeenCalledWith(
        defaultLocale,
        "test",
        "options.command.description",
      );
      expect(result.description).toBe("Get help for a specific command.");
      expect(result.description_localizations).toEqual({
        fr: "Obtenir de l'aide pour une commande précise.",
      });
    });
  });

  describe("localizeOptions", () => {
    it("should localize nested options and keep required ones first", () => {
      // Arrange
      const locales: Locale[] = [defaultLocale, "fr" as Locale];
      translationHandlerMock.getLocales = jest.fn().mockReturnValue(locales);
      translationHandlerMock.translateCommand = jest.fn().mockImplementation(
        (locale: Locale, commandName: string, translationKey: string) => {
          if (commandName !== "test") {
            return "Missing translation for " + translationKey;
          }

          const translations: Record<string, Partial<Record<Locale, string>>> = {
            "options.required.description": {
              [defaultLocale]: "Required option",
              fr: "Option requise",
            },
            "options.optional.description": {
              [defaultLocale]: "Optional option",
              fr: "Option facultative",
            },
            "options.group.description": {
              [defaultLocale]: "Group option",
              fr: "Option groupe",
            },
            "options.child.description": {
              [defaultLocale]: "Child option",
              fr: "Option enfant",
            },
          };

          return translations[translationKey]?.[locale]
            ?? "Missing translation for " + translationKey;
        },
      );

      const options = [
        {
          name: "optional",
          type: ApplicationCommandOptionType.String,
          required: false,
          description: "Optional option",
        },
        {
          name: "group",
          type: ApplicationCommandOptionType.Subcommand,
          required: false,
          description: "Group option",
          options: [{
            name: "child",
            type: ApplicationCommandOptionType.String,
            required: false,
            description: "Child option",
          }],
        },
        {
          name: "required",
          type: ApplicationCommandOptionType.String,
          required: true,
          description: "Required option",
        },
      ] as APIApplicationCommandOption[];

      // Act
      const result = (command as any).localizeOptions(options);

      // Assert
      expect(result?.map((option: APIApplicationCommandOption) => option.name)).toEqual([
        "required",
        "optional",
        "group",
      ]);
      expect(result?.[0]).toEqual(expect.objectContaining({
        name: "required",
        description: "Required option",
        description_localizations: {
          fr: "Option requise",
        },
      }));
      expect(result?.[2]).toEqual(expect.objectContaining({
        name: "group",
        description: "Group option",
        description_localizations: {
          fr: "Option groupe",
        },
        options: [expect.objectContaining({
          name: "child",
          description: "Child option",
          description_localizations: {
            fr: "Option enfant",
          },
        })],
      }));
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
