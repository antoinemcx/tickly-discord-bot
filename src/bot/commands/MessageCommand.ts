import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type {
  Locale,
  MessageContextMenuCommandInteraction,
} from "discord.js";
import { ApplicationCommandType } from "discord.js";
import { ContextMenuCommand } from "./ContextMenuCommand";

/**
 * Base abstraction class for all message commands.
 * Message commands are executed by the user by right-clicking a message.
 */
export abstract class MessageCommand extends ContextMenuCommand {
  protected readonly type = ApplicationCommandType.Message;

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
