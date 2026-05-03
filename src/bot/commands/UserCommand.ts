import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type {
  APIApplicationCommand,
  Locale,
  UserContextMenuCommandInteraction,
} from "discord.js";
import { ApplicationCommandType } from "discord.js";
import { RegisterableBaseCommand } from "./RegisterableBaseCommand";

/**
 * Base abstraction class for all user commands.
 * User commands are executed by the user by right-clicking a user.
 */
export abstract class UserCommand extends RegisterableBaseCommand {
  public readonly isRegisterable = true;
  protected readonly type: APIApplicationCommand["type"]
    = ApplicationCommandType.User;

  /**
   * Discord API data with no description, as it is not allowed for
   * context menu user commands.
   * @see https://docs.discord.com/developers/interactions/application-commands#user-commands
   */
  protected abstract readonly data: RegisterableBaseCommand["data"]
    & { description?: never; description_localizations?: never };

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
