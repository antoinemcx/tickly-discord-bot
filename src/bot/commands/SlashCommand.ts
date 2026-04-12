import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type {
  APIApplicationCommand,
  ChatInputCommandInteraction,
  Locale,
} from "discord.js";
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
}
