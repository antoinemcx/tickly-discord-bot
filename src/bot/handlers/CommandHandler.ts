import type { BaseCommand } from "@bot/commands/BaseCommand";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type { CommandInteraction, Interaction, Locale } from "discord.js";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { MessageCommand } from "@bot/commands/MessageCommand";
import { SlashCommand } from "@bot/commands/SlashCommand";
import { UserCommand } from "@bot/commands/UserCommand";
import { Tickly } from "@bot/Tickly";
import {
  displayDetailedError,
  displayError,
  displayInfo,
  displaySuccess,
  displayWarning,
  generateErrorCode,
  pink,
} from "@src/utils/logger";
import { Events, REST, Routes } from "discord.js";
import { Handler } from "./Handler";

/**
 * Manage all the commands of a discord application.
 * Retrieve, store and provide access to commands, including (/) commands.
 */
export class CommandHandler extends Handler {
  public static readonly commandsDirectory = join(__dirname, "..", "commands");

  private readonly slashCommands: Map<string, SlashCommand>;
  private readonly messageContextMenuCommands: Map<string, MessageCommand>;
  private readonly userContextMenuCommands: Map<string, UserCommand>;

  /**
   * Initialize this with empty state. You must call setClient() and setup()
   * to load the commands and registerSlashCommands() register them.
   * @param todoistClient the Todoist client all the commands will use
   * @param repositories the repository factory all the commands will use
   */
  constructor(
    private readonly todoistClient: TodoistApiClient,
    private readonly repositories: RepositoryFactory,
  ) {
    super();
    this.slashCommands = new Map<string, SlashCommand>();
    this.messageContextMenuCommands = new Map<string, MessageCommand>();
    this.userContextMenuCommands = new Map<string, UserCommand>();
  }

  public async setup(): Promise<void> {
    if (!this.client) {
      throw new Error("The client is not set for handler.");
    }
    await this.loadCommands();

    /* Handle interactions after the client is ready */
    this.client.once(Events.ClientReady, async () => {
      this.client!.on(
        Events.InteractionCreate,
        interaction => this.handleInteraction(interaction),
      );
    });
  }

  /**
   * Loads all commands from the file system.
   * @returns a promise that resolves when the commands are loaded
   */
  private async loadCommands(): Promise<void> {
    let files: string[];
    this.slashCommands.clear();
    this.messageContextMenuCommands.clear();
    this.userContextMenuCommands.clear();

    try {
      const entries = readdirSync(CommandHandler.commandsDirectory);
      displayInfo("Loading slash commands...");

      for (const entry of entries) {
        const filePath = join(CommandHandler.commandsDirectory, entry);

        if (statSync(filePath).isDirectory()) {
          files = readdirSync(filePath);

          for (const file of files) {
            const module = await import(join(filePath, file));
            this.storeCommand(module.default);
          }
        }
      }
      displaySuccess(`${pink(this.slashCommands.size)} (/) commands`
        + (this.messageContextMenuCommands.size > 0
          ? `, ${pink(this.messageContextMenuCommands.size)} message commands`
          : "")
        + (this.userContextMenuCommands.size > 0
          ? ` and ${pink(this.userContextMenuCommands.size)} user commands`
          : "")
        + ` loaded in ${pink(entries.length)} categories.`);
    } catch (e) {
      displayWarning("An error happened, no commands were found.");
      console.error(e);
    }
  }

  private storeCommand(constructor: any): void {
    if (!this.client) {
      throw new Error("The client is not set for handler.");
    }

    const Command = constructor as new (
      client: Tickly,
      todoistClient: TodoistApiClient,
      repositories: RepositoryFactory,
    ) => BaseCommand;

    const command = new Command(
      this.client,
      this.todoistClient,
      this.repositories,
    );

    if (command instanceof SlashCommand) {
      this.slashCommands.set(command.getName(), command);
    } else if (command instanceof MessageCommand) {
      this.messageContextMenuCommands.set(command.getName(), command);
    } else if (command instanceof UserCommand) {
      this.userContextMenuCommands.set(command.getName(), command);
    } else {
      throw new TypeError(`Unknown command type for ${command.getName()}`);
    }
  }

  /**
   * Synchronizes this bot's commands with the Discord API.
   *
   * It replaces all the existing commands with the ones currently loaded
   * in this handler.
   *
   * @param token the token to authenticate the request to the Discord API
   * @param guildId the guild id to refresh in guild commands
   *                (or nothing for global commands)
   * @throws {Error} if the client is not set for this handler or is not ready
   */
  public async registerCommands(token: string, guildId?: null | string): Promise<void> {
    if (!this.client) {
      throw new Error("The client is not set for handler.");
    } else if (!this.client.isReady()) {
      throw new Error("The client must be ready to register commands.");
    }
    const rest = new REST().setToken(token);
    const commands = Array.from(this.getAllCommands().values());

    try {
      displayInfo("Now refreshing commands "
        + (guildId ? `in guild ${guildId}` : "globally")
        + "...");
      await rest.put(
        guildId
          ? Routes.applicationGuildCommands(this.client.user.id, guildId)
          : Routes.applicationCommands(this.client.user.id),
        { body: commands.map(cmd => cmd.getData()) },
      );

      displaySuccess("Application commands reloaded"
        + ` (${commands.length} commands).`);
    } catch (error) {
      displayError(error instanceof Error
        ? `${error.name}: ${error.message}`
        : "Unknown error while refreshing application commands.");
    }
  }

  /**
   * Retrieves all of this' commands
   * @returns all the handler's commands by their name
   */
  public getAllCommands(): Map<string, BaseCommand> {
    return new Map<string, BaseCommand>([
      ...this.messageContextMenuCommands,
      ...this.userContextMenuCommands,
      ...this.slashCommands,
    ]);
  }

  /**
   * Handles a user interaction wheteher it is a slash command, a context
   * menu command, a modal submit or any other type.
   * It handles these in both user and guild application commands contexts.
   *
   * The interaction is handled in the preferred language of the user if
   * configured, otherwise in the interaction locale or in english by default.
   *
   * @param interaction the interaction to handle
   * @returns a promise that resolves when the interaction is handled
   * @throws {Error} if the client is not set for this handler
   */
  private async handleInteraction(interaction: Interaction): Promise<void> {
    let command: BaseCommand | undefined;
    if (!this.client) {
      throw new Error("The client is not set for handler.");
    }

    /* Retrieve the preferred language for commands */
    const translationHandler = this.client.getTranslationHandler();
    const defaultLocale = interaction.locale;
    let language: Locale = defaultLocale;
    try {
      const preferredLanguage = await this.repositories
        .getUserRepository()
        .getUserPreferredLanguage(interaction.user.id);
      language = preferredLanguage?.code ?? defaultLocale;
    } catch {
      // Interaction locale will be used
    }
    if (!translationHandler.isSupportedLocale(language)) {
      language = translationHandler.getDefaultLocale();
    }

    /* Retrieve the interaction command */
    if (interaction.isChatInputCommand()) {
      command = this.slashCommands.get(interaction.commandName);
    } else if (interaction.isMessageContextMenuCommand()) {
      command = this.messageContextMenuCommands.get(interaction.commandName);
    } else if (interaction.isUserContextMenuCommand()) {
      command = this.userContextMenuCommands.get(interaction.commandName);
    }

    if (interaction.isCommand() && command
      /* isCommandRunnable handles runnable errors */
      && this.isCommandRunnable(command, interaction, language)) {
      try {
        await command.execute(interaction, language);
      } catch (error) {
        const errorCode = generateErrorCode();
        displayDetailedError(
          `Unknown error while executing ${command?.getData().name || ""} command`,
          error,
          errorCode,
        );
        interaction.reply({
          content: this.translate(language, "executionError", {
            errorCode,
          }),
          ephemeral: true,
        });
      }
    } // else if not found, let Discord handle the error
  }

  /**
   * Checks if a a interaction user has the permissions to run a command.
   * If the command is not runnable, it replies with an explicit message.
   *
   * @param command command to be run
   * @param interaction interaction that triggered the command
   * @param language locale code of the response language
   * @returns true if the command is runnable, false if not.
   */
  private isCommandRunnable(
    command: BaseCommand,
    interaction: CommandInteraction,
    language: Locale,
  ): boolean {
    let isRunnable: boolean = false;

    if (command.isAdminOnly // private command
      && !this.client?.getConfig().ownerIds.includes(interaction.user.id)) {
      interaction.reply({
        content: this.translate(language, "privateCommand"),
        ephemeral: true,
      });
    } else if (!command.hasUserPermission(interaction)) { // missing permissions
      const permissionFlags
        = Tickly.permissionsToText(command.userRequiredPermissions);

      interaction.reply({
        content: this.translate(language, "missingPermission.user", {
          required: permissionFlags.map(p => `\`${p}\``).join(", "),
        }),
        ephemeral: true,
      });
    } else if (!command.hasBotPermission(interaction)) { // bot missing permissions
      const permissionFlags
        = Tickly.permissionsToText(command.clientRequiredPermissions);

      interaction.reply({
        content: this.translate(language, "missingPermission.bot", {
          required: permissionFlags.map(p => `\`${p}\``).join(", "),
        }),
        ephemeral: true,
      });
    } else { // command is runnable
      isRunnable = true;
    }

    return isRunnable;
  }

  private translate(
    language: Locale,
    translationKey: string,
    parameters: Record<string, string> = {},
  ): string {
    return this.client?.getTranslationHandler()
      .translateCommon(
        language,
        `interactionHandling.${translationKey}`,
        parameters,
      ) ?? "Translation error";
  }
}
