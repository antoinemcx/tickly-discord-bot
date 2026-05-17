import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type {
  APIApplicationCommand,
  APIApplicationCommandOption,
  APIApplicationCommandSubcommandOption,
  ApplicationCommandOptionType,
  BaseInteraction,
  Locale,
  MessageComponentInteraction,
  PermissionResolvable,
} from "discord.js";
import {

  ApplicationIntegrationType,

} from "discord.js";

/** Handler function for a component interaction (button, select menu, etc.). */
export type MessageComponentHandler = (
  interaction: MessageComponentInteraction,
  language: Locale,
) => Promise<void>;

export type LocalizedCommandOption = Omit<
  APIApplicationCommandOption,
  "description" | "options"
> & {
  description?: APIApplicationCommandOption["description"];
  options?: LocalizedCommandOption[];
};

export type CommandData = Omit<
  APIApplicationCommand,
  "type" // handled separately in abstract subclasses
  | "id" | "application_id" | "guild_id"
  | "version" | "default_member_permissions"
  | "description" | "options"
> & {
  description?: APIApplicationCommand["description"];
  options?: LocalizedCommandOption[];
};

export type SubCommandData = Omit<
  APIApplicationCommandSubcommandOption,
  "type" // handled separately in SubCommand class
  | "description"
  | "options"
> & {
  description?: APIApplicationCommandSubcommandOption["description"];
  options?: LocalizedCommandOption[];
};

/** Base class for all discord bots commands and subcommands. */
export abstract class BaseCommand {
  public static readonly EMBED_COLOR = 0xE44232;

  /** Discord API data. */
  protected abstract readonly data: CommandData | SubCommandData;

  /** Whether the command is only available to administrators. */
  public readonly isAdminOnly: boolean = false;
  /** The permissions required to use the command. */
  public readonly userRequiredPermissions: PermissionResolvable[] = [];
  /** The permissions required for the bot to be able to run the command. */
  public readonly clientRequiredPermissions: PermissionResolvable[] = [];

  /** Registered component interaction handlers keyed by full customId. */
  private readonly messageComponentHandlers = new Map<string, MessageComponentHandler>();

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

  /** @returns the command name used to index it in handler collections. */
  public getName(): string {
    return this.data.name;
  }

  /**
   * Returns the command namespace used to look up translations.
   *
   * Subclasses may override this when their translations live under a parent
   * command namespace, such as subcommands.
   *
   * @returns the translation namespace for this command
   */
  protected getTranslationCommandName(): string {
    return this.getName();
  }

  /** @returns the data to register the command */
  public abstract getData():
    CommandData & { type: APIApplicationCommand["type"] }
    | SubCommandData & { type: ApplicationCommandOptionType.Subcommand };

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
   * Checks if the bot is installed as a user integration.
   * @param interaction the interaction context to check from
   * @returns true if the bot is user-installed, false otherwise
   */
  public isUserInstalled(interaction: BaseInteraction): boolean {
    return interaction.authorizingIntegrationOwners
      ?.[ApplicationIntegrationType.UserInstall] !== undefined;
  }

  /**
   * Builds a customId for a component scoped to this command.
   * The resulting format is "commandName:action".
   * @param action identifier for the component action
   * @returns the full customId string
   */
  protected buildComponentId(action: string): string {
    return `${this.getName()}:${action}`;
  }

  /**
   * Registers a handler for a component interaction with this command.
   * The full customId is built automatically as "commandName:action".
   * @param action identifier matching the one used in buildComponentId
   * @param handler async function invoked when the component is interacted with
   */
  protected onMessageComponent(action: string, handler: MessageComponentHandler): void {
    const fullId = this.buildComponentId(action);
    this.messageComponentHandlers.set(fullId, handler);
  }

  /**
   * Returns registered component interaction handlers.
   * @returns read-only map of customId to handler
   */
  public getMessageComponentHandlers(): ReadonlyMap<string, MessageComponentHandler> {
    return this.messageComponentHandlers;
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
      .translateCommand(
        language,
        this.getTranslationCommandName(),
        translationKey,
        parameters,
      );
  }
}
