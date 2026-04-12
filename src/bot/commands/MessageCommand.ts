import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type {
  APIApplicationCommand,
  Locale,
  MessageContextMenuCommandInteraction,
} from "discord.js";
import { ApplicationCommandType } from "discord.js";
import { BaseCommand } from "./BaseCommand";

/**
 * Base abstraction class for all message commands.
 * Message commands are executed by the user by right-clicking a message.
 */
export abstract class MessageCommand extends BaseCommand {
  protected readonly type: APIApplicationCommand["type"]
    = ApplicationCommandType.Message;

  /**
   * Discord API data with no description, as it is not allowed for
   * context menu commands.
   * @see https://docs.discord.com/developers/interactions/application-commands#message-commands
   */
  protected abstract readonly data: BaseCommand["data"]
    & { description?: never; description_localizations?: never };

  constructor(
    client: Tickly,
    todoistClient: TodoistApiClient,
    repositories: RepositoryFactory,
  ) {
    super(client, todoistClient, repositories);
  }

  public abstract execute(
    interaction: MessageContextMenuCommandInteraction,
    language: Locale
  ): Promise<void>;
}
