import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type {
  Locale,
  LocalizationMap,
} from "discord.js";
import type { LocalizedCommandOption } from "./BaseCommand";
import { TranslationHandler } from "@bot/handlers/TranslationHandler";
import { BaseCommand } from "./BaseCommand";

/**
 * Shared helper for commands that need localized descriptions.
 *
 * This helper also supports sorting options by required ones first,
 * as required by the discord API.
 */
export abstract class LocalizedCommand extends BaseCommand {
  constructor(
    client: Tickly,
    todoistClient: TodoistApiClient,
    repositories: RepositoryFactory,
  ) {
    super(client, todoistClient, repositories);
  }

  /**
   * Builds the "name" and "name_localizations" fields for the
   * command registration data, based on the translations available in the
   * translation handler.
   *
   * The "name" field is set to the default locale translation, or an empty
   * string if it is not found. The "name_localizations" field contains
   * the translations for the other locales, if any.
   *
   * @returns an object containing the "name" and "name_localizations" fields
   */
  protected buildNameFields(): {
    name: string;
    name_localizations?: LocalizationMap;
  } {
    const localizations = this.client.getTranslationHandler().getCommandNames(
      this.getTranslationCommandName(),
    );
    const { defaultValue, otherLocalizations }
      = this.splitLocalizationsByDefault(localizations);

    return {
      name: defaultValue,
      name_localizations: otherLocalizations,
    };
  }

  /**
   * Builds the "description" and "description_localizations" fields for the
   * command registration data, based on the translations available in the
   * translation handler.
   *
   * The "description" field is set to the default locale translation, or an
   * empty string if it is not found. The "description_localizations" field
   * contains the translations for the other locales, if any.
   *
   * @returns an object containing the "description"
   *   and "description_localizations" fields
   */
  protected buildDescriptionFields(): {
    description: string;
    description_localizations?: LocalizationMap;
  } {
    const localizations
      = this.client.getTranslationHandler().getCommandDescriptions(
        this.getTranslationCommandName(),
      );
    const { defaultValue, otherLocalizations }
      = this.splitLocalizationsByDefault(localizations);

    return {
      description: defaultValue,
      description_localizations: otherLocalizations,
    };
  }

  /**
   * Splits a localization map into the default locale value and the remaining
   * localizations. Returns undefined for otherLocalizations when empty.
   *
   * @param localizations the full localization map
   * @returns the default value and remaining localizations (or undefined)
   */
  private splitLocalizationsByDefault(localizations: LocalizationMap): {
    defaultValue: string;
    otherLocalizations: LocalizationMap | undefined;
  } {
    const defaultLocale
      = this.client.getTranslationHandler().getDefaultLocale();
    const defaultValue = localizations[defaultLocale] ?? "";
    const otherLocalizations: LocalizationMap = {};

    for (const [locale, value] of Object.entries(localizations)) {
      if (locale !== defaultLocale) {
        otherLocalizations[locale as Locale] = value;
      }
    }

    return {
      defaultValue,
      otherLocalizations: Object.keys(otherLocalizations).length > 0
        ? otherLocalizations
        : undefined,
    };
  }

  /**
   * Builds an array of localized choices for a command option.
   *
   * Names are read from "options.<optionName>.choices.<value>" in the command's
   * translation file, falling back to the raw value string when the key is missing.
   *
   * @param optionName the name of the option that holds these choices
   * @param values the possible choice values
   * @returns localized choice objects ready for Discord API registration
   */
  protected buildOptionChoices(
    optionName: string,
    values: readonly string[],
  ): Array<{ name: string; name_localizations?: LocalizationMap; value: string }> {
    const handler = this.client.getTranslationHandler();
    const defaultLocale = handler.getDefaultLocale();

    return values.map((value) => {
      const name_localizations: LocalizationMap = {};
      let name = value;

      for (const locale of handler.getLocales()) {
        const label = handler.translateCommand(
          locale,
          this.getTranslationCommandName(),
          `options.${optionName}.choices.${value}`,
        );
        const isMissing = label.startsWith(TranslationHandler.MISSING_TRANSLATION_MESSAGE);

        if (!isMissing && locale === defaultLocale) {
          name = label;
        } else if (!isMissing) {
          name_localizations[locale] = label;
        }
      }

      return {
        name,
        ...(Object.keys(name_localizations).length > 0 ? { name_localizations } : {}),
        value,
      };
    });
  }

  /**
   * Builds the translated description fields for a command option.
   *
   * The default locale description is used as the main description, while
   * the other locales are collected in description_localizations.
   *
   * @param optionName the option name to translate
   * @param fallbackDescription description to use if the default locale is missing
   * @returns the translated description fields for the option
   */
  protected buildOptionDescriptionFields(
    optionName: string,
    fallbackDescription: string = "",
  ): {
    description: string;
    description_localizations?: LocalizationMap;
  } {
    const translationHandler = this.client.getTranslationHandler();
    const defaultLocale = translationHandler.getDefaultLocale();
    const descriptionLocalizations: LocalizationMap = {};
    let description = fallbackDescription;

    for (const locale of translationHandler.getLocales()) {
      const translatedDescription = translationHandler.translateCommand(
        locale,
        this.getTranslationCommandName(),
        `options.${optionName}.description`,
      );

      const isMissingTranslation = translatedDescription.startsWith(
        TranslationHandler.MISSING_TRANSLATION_MESSAGE,
      );

      if (!isMissingTranslation && locale === defaultLocale) {
        description = translatedDescription;
      } else if (!isMissingTranslation) {
        descriptionLocalizations[locale] = translatedDescription;
      }
    }

    return {
      description,
      description_localizations: Object.keys(descriptionLocalizations).length > 0
        ? descriptionLocalizations
        : undefined,
    };
  }

  /**
   * Localizes the given command options and recursively handles nested options.
   * Handles description localization and, when an option carries a choices
   * array, replaces choice names with translations from
   * "options.<optionName>.choices.<value>" keys.
   *
   * @param options the options to localize
   * @returns the localized options, or undefined if the input was undefined
   */
  protected localizeOptions<T extends LocalizedCommandOption>(
    options: T[] | undefined,
  ): T[] | undefined {
    if (!options) {
      return undefined;
    }

    return this.sortOptionsByRequired(options.map((option) => {
      const localizedOption = {
        ...option,
        ...this.buildOptionDescriptionFields(option.name, option.description ?? ""),
      } as T;

      if (option.options) {
        localizedOption.options = this.localizeOptions(option.options);
      }

      /* Auto-localize choices when the option declares a choices array */
      const rawChoices = (option as unknown as { choices?: Array<{ value: string }> }).choices;
      if (rawChoices?.length) {
        (localizedOption as unknown as { choices: unknown }).choices
          = this.buildOptionChoices(option.name, rawChoices.map(c => c.value));
      }

      return localizedOption;
    })) as T[];
  }

  /**
   * Sorts the given options by required ones first, then optional ones, as
   * required by the discord API.
   * @param options the options to sort
   * @returns the sorted options, or undefined if the input was undefined
   */
  protected sortOptionsByRequired<T extends { required?: boolean }>(
    options: T[] | undefined,
  ): T[] | undefined {
    return options?.toSorted((a, b) => {
      if ((a as any).required && !(b as any).required) {
        return -1;
      } else if (!(a as any).required && (b as any).required) {
        return 1;
      } else {
        return 0;
      }
    });
  }
}
