import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type {
  APIApplicationCommand,
  BaseInteraction,
  Locale,
  PermissionResolvable,
} from "discord.js";

export type CommandData = Omit<
  APIApplicationCommand,
  "id" | "application_id" | "guild_id"
  | "version" | "default_member_permissions" | "description"
> & { description?: APIApplicationCommand["description"] };

/** Base class for all discord bots commands. */
export abstract class BaseCommand {
  /** Discord API command type. */
  protected abstract readonly type: APIApplicationCommand["type"];

  /** Discord API data to register the command. */
  protected abstract readonly data: Omit<CommandData, "type">
    & { integration_types: APIApplicationCommand["integration_types"] };

  // Additional options for command settings
  /** Whether the command is only available to administrators. */
  public readonly isAdminOnly: boolean = false;
  /** The permissions required to use the command. */
  public readonly userRequiredPermissions: PermissionResolvable[] = [];
  /** The permissions required for the bot to be able to run the command. */
  public readonly clientRequiredPermissions: PermissionResolvable[] = [];

  /**
   * Constructs and initializes a new discord command.
   * @param client discord client currently running
   * @param todoistClient todoist client currently running
   * @param repositories repositories factory to access the database
   */
  constructor(
    protected client: Tickly,
    protected todoistClient: TodoistApiClient,
    protected repositories: RepositoryFactory,
  ) {}

  /** @returns the data to register the command */
  public getData(): CommandData {
    return { ...this.data, type: this.type };
  }

  /** @returns the command name used to index it in handler collections. */
  public getName(): string {
    return this.data.name;
  }

  /**
   * Executes the command's behavior.
   * @param interaction typed command interaction
   * @param language locale code of the response language
   */
  public abstract execute(
    interaction: BaseInteraction, language: Locale): Promise<void>;

  /**
   * Verifies that a discord user has permissions to use the command.
   * @param interaction command interaction to check the user permissions for
   * @returns true if the user has the required permissions, false if not
   */
  public hasUserPermission(interaction: BaseInteraction): boolean {
    return this.userRequiredPermissions === undefined
      || this.userRequiredPermissions.length === 0
      || (interaction.memberPermissions?.has(this.userRequiredPermissions) ?? false);
  }

  /**
   * Verifies that the discord client has permissions to run the command.
   * @param interaction command interaction to check the bot permissions for
   * @returns true if the bot has the required permissions, false if not
   */
  public hasBotPermission(interaction: BaseInteraction): boolean {
    return this.clientRequiredPermissions === undefined
      || this.clientRequiredPermissions.length === 0
      || interaction.appPermissions.has(this.clientRequiredPermissions);
  }

  /**
   * Translates a text from the command translations.
   * @param language language code
   * @param translationKey identifier in the command translations
   * @param parameters optional parameters for placeholders
   * @returns translated text or a fallback if translation is missing
   */
  protected translate(
    language: Locale,
    translationKey: string,
    parameters: Record<string, string> = {},
  ): string {
    return this.client.getTranslationHandler()
      .translateCommand(language, this.data.name, translationKey, parameters);
  }
}
