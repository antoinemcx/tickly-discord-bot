import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type {
  APIApplicationCommand,
  ChatInputCommandInteraction,
  Locale,
  LocalizationMap,
} from "discord.js";
import type { CommandData } from "./BaseCommand";
import { displayWarning } from "@src/utils/logger";
import { ApplicationCommandType } from "discord.js";
import { BaseCommand } from "./BaseCommand";

/**
 * Base abstraction class for all slash commands.
 * Slash commands (or chat inputs) are executed by the user by typing "/".
 *
 * A slash command can have groups and subcommands to organize commands.
 */
export abstract class SlashCommand extends BaseCommand {
  protected readonly type: APIApplicationCommand["type"]
    = ApplicationCommandType.ChatInput;

  constructor(
    client: Tickly,
    todoistClient: TodoistApiClient,
    repositories: RepositoryFactory,
  ) {
    super(client, todoistClient, repositories);
  }

  public abstract execute(
    interaction: ChatInputCommandInteraction, language: Locale): Promise<void>;

  public override getData(): CommandData {
    const translationHandler = this.client.getTranslationHandler();
    const defaultLocale = translationHandler.getDefaultLocale();
    const descriptions = translationHandler.getCommandDescriptions(this.data.name);
    const defaultDescription = descriptions[defaultLocale] ?? "";
    const descriptionLocalizations: LocalizationMap = {};

    /* Localized descriptions for locales other than the default one */
    for (const [locale, localizedDescription] of Object.entries(descriptions)) {
      if (locale !== defaultLocale) {
        descriptionLocalizations[locale as Locale] = localizedDescription;
      }
    }

    if (!defaultDescription) { // do not throw, just log
      displayWarning(`No translation found for command "`
        + this.data.name + `" description in default "${defaultLocale}" locale.`);
    }
    return {
      ...super.getData(),
      description: defaultDescription,
      description_localizations: Object.keys(descriptionLocalizations).length > 0
        ? descriptionLocalizations
        : undefined,
    };
  }
}
