import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type {
  APIApplicationCommand,
  APIApplicationCommandOption,
  ChatInputCommandInteraction,
  Locale,
} from "discord.js";
import type { CommandData } from "./BaseCommand";
import type { SubCommand } from "./SubCommand";
import { displayWarning } from "@src/utils/logger";
import { ApplicationCommandOptionType, ApplicationCommandType } from "discord.js";
import { RegisterableBaseCommand } from "./RegisterableBaseCommand";

/**
 * Base abstraction class for all slash commands.
 * Slash commands (or chat inputs) are executed by the user by typing "/".
 *
 * A slash command can have groups and subcommands to organize commands.
 */
export abstract class SlashCommand extends RegisterableBaseCommand {
  protected readonly type: APIApplicationCommand["type"]
    = ApplicationCommandType.ChatInput;

  /**
   * Optional subcommands attached to this slash command. Subclasses may
   * initialize this in their constructors.
   */
  protected subcommands?: SubCommand[];

  constructor(
    client: Tickly,
    todoistClient: TodoistApiClient,
    repositories: RepositoryFactory,
  ) {
    super(client, todoistClient, repositories);
  }

  public abstract execute(
    interaction: ChatInputCommandInteraction, language: Locale): Promise<void>;

  /**
   * Retrieves the data and type of the command to register it and logs
   * warnings if any issues are found.
   *
   * The main "description" field is set to the default locale translation,
   * while the "description_localizations" field contains the translations
   * for the other locales. An empty string is used as fallback if no
   * translation is found for the default locale.
   *
   * "name_localizations" is not supported for this project as command names
   * should be the same across all locales to avoid confusion.
   *
   * The options are sorted by required ones first, then optional ones, as
   * required by the discord API.
   *
   * @returns the data to register the command
   */
  public override getData(): CommandData & { type: APIApplicationCommand["type"] } {
    const descriptionFields = this.buildDescriptionFields();
    if (!descriptionFields.description) { // do not throw, just log
      displayWarning(`No translation found for command "${this.data.name}"`
        + ` description in default "`
        + `${this.client.getTranslationHandler().getDefaultLocale()}" locale.`);
    }

    const subCommandOptions = this.subcommands?.map(s => s.getData()) ?? [];
    for (const subCommand of this.subcommands ?? []) {
      if (subCommand.getParentCommandName() !== this.data.name) {
        displayWarning(`SubCommand "${subCommand.getData().name}" parent command`
          + ` name does not match its parent command "${this.data.name}".`);
      }
    }
    const options = this.data.options ?? [];
    for (const option of options) {
      if (option.type === ApplicationCommandOptionType.Subcommand) {
        displayWarning(
          `Command "${this.data.name}" has a subcommand option declared in its `
          + `data, but it should be declared in its "subcommands" attribute.`,
        );
      }
    }

    return {
      ...super.getData(),
      description: descriptionFields.description,
      description_localizations: descriptionFields.description_localizations,
      options: this.sortOptionsByRequired([
        ...subCommandOptions,
        ...options,
      ] as APIApplicationCommandOption[]),
    };
  }

  public getSubCommands(): SubCommand[] {
    return this.subcommands?.slice() ?? [];
  }
}
