import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type {
  APIApplicationCommandOption,
  Locale,
  LocalizationMap,
} from "discord.js";
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
    const translationHandler = this.client.getTranslationHandler();
    const defaultLocale = translationHandler.getDefaultLocale();
    const descriptions = translationHandler.getCommandDescriptions(
      this.getTranslationCommandName(),
    );
    const defaultDescription = descriptions[defaultLocale] ?? "";
    const descriptionLocalizations: LocalizationMap = {};

    for (const [locale, localizedDescription] of Object.entries(descriptions)) {
      if (locale !== defaultLocale) {
        descriptionLocalizations[locale as Locale] = localizedDescription;
      }
    }

    return {
      description: defaultDescription,
      description_localizations: Object.keys(descriptionLocalizations).length > 0
        ? descriptionLocalizations
        : undefined,
    };
  }

  /**
   * Sorts the given options by required ones first, then optional ones, as
   * required by the discord API.
   * @param options the options to sort
   * @returns the sorted options, or undefined if the input was undefined
   */
  protected sortOptionsByRequired<T extends APIApplicationCommandOption>(
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
