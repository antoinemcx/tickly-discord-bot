import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type {
  Locale,
  UserContextMenuCommandInteraction,
} from "discord.js";
import { ApplicationCommandType } from "discord.js";
import { ContextMenuCommand } from "./ContextMenuCommand";

/**
 * Base abstraction class for all user commands.
 * User commands are executed by the user by right-clicking a user.
 */
export abstract class UserCommand extends ContextMenuCommand {
  protected readonly type = ApplicationCommandType.User;

  constructor(
    client: Tickly,
    todoistClient: TodoistApiClient,
    repositories: RepositoryFactory,
  ) {
    super(client, todoistClient, repositories);
  }

  public abstract execute(
    interaction: UserContextMenuCommandInteraction,
    language: Locale
  ): Promise<void>;
}
