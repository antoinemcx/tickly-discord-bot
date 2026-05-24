import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type {
  APIApplicationCommand,
  ApplicationCommandType,
  Locale,
  MessageContextMenuCommandInteraction,
  UserContextMenuCommandInteraction,
} from "discord.js";
import type { CommandData } from "./BaseCommand";

import { RegisterableBaseCommand } from "./RegisterableBaseCommand";

/**
 * Base abstraction class for all context menu commands (message and user).
 * Context menu commands are executed by the user by right-clicking a message or a user.
 */
export abstract class ContextMenuCommand extends RegisterableBaseCommand {
  protected abstract readonly type:
    ApplicationCommandType.Message | ApplicationCommandType.User;

  /** Translation key for the command. */
  protected abstract readonly translationName: string;

  /**
   * Discord API data with no description, as it is not allowed for
   * context menu commands, and no name, as it is localized.
   * @see https://docs.discord.com/developers/interactions/application-commands#contexts
   */
  protected abstract readonly data: RegisterableBaseCommand["data"]
    & {
      name?: never;
      description?: never;
      description_localizations?: never;
      options?: never;
    };

  constructor(
    client: Tickly,
    todoistClient: TodoistApiClient,
    repositories: RepositoryFactory,
  ) {
    super(client, todoistClient, repositories);
  }

  public abstract execute(
    interaction: MessageContextMenuCommandInteraction | UserContextMenuCommandInteraction,
    language: Locale
  ): Promise<void>;

  public override getName(): string {
    return this.translationName;
  }

  /**
   * Retrieves the data of the command to register it.
   *
   * The main "name" field is set to the default locale translation,
   * while the "name_localizations" field contains the translations
   * for the other locales. An empty string is used as fallback if no
   * translation is found for the default locale.
   *
   * @returns the data to register the command
   * @throws if no translation is found for the default locale
   */
  public override getData(): CommandData & {
    name: APIApplicationCommand["name"];
    type: APIApplicationCommand["type"];
  } {
    const nameFields = this.buildNameFields();
    if (!nameFields.name) {
      throw new Error(`No translation found for context menu command "`
        + `${this.translationName}" name in default "`
        + `${this.client.getTranslationHandler().getDefaultLocale()}" locale.`);
    }

    return {
      ...super.getData(),
      name: nameFields.name,
      name_localizations: nameFields.name_localizations,
    };
  }
}
