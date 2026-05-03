import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type { ChatInputCommandInteraction, Locale } from "discord.js";
import type { SubCommandData } from "./BaseCommand";
import { ApplicationCommandOptionType } from "discord.js";
import { LocalizedCommand } from "./LocalizedCommand";

/**
 * Base abstraction class for subcommands attached to a slash command.
 * Subcommands represent an `ApplicationCommandOptionType.Subcommand` object.
 */
export abstract class SubCommand extends LocalizedCommand {
  protected abstract readonly data: SubCommandData;

  constructor(
    client: Tickly,
    todoistClient: TodoistApiClient,
    repositories: RepositoryFactory,
    private readonly parentCommandName: string,
  ) {
    super(client, todoistClient, repositories);
    if (!parentCommandName) {
      throw new Error("SubCommand must have a parent command name.");
    }
  }

  public getParentCommandName(): string {
    return this.parentCommandName;
  }

  protected override getTranslationCommandName(): string {
    return `${this.getParentCommandName()}.${this.getName()}`;
  }

  public getData(): SubCommandData & {
    type: ApplicationCommandOptionType.Subcommand;
  } {
    const descriptionFields = this.buildDescriptionFields();

    return {
      ...this.data,
      type: ApplicationCommandOptionType.Subcommand,
      description: descriptionFields.description,
      description_localizations: descriptionFields.description_localizations,
      options: this.sortOptionsByRequired(this.data.options ?? []),
    };
  }

  public abstract execute(
    interaction: ChatInputCommandInteraction, language: Locale): Promise<void>;
}
