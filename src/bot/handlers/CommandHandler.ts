import type { BaseCommand } from "@bot/commands/BaseCommand";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { Language } from "@database/schema";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type { CommandInteraction, GuildMember, Interaction } from "discord.js";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { MessageCommand } from "@bot/commands/MessageCommand";
import { SlashCommand } from "@bot/commands/SlashCommand";
import { UserCommand } from "@bot/commands/UserCommand";
import { Tickly } from "@bot/Tickly";
import {
  displayError,
  displayInfo,
  displayLoaded,
  displaySuccess,
  displayWarning,
} from "@src/utils/logger";
import { Events, Locale, REST, Routes } from "discord.js";
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
   * Initialize this with empty state. ou must call setClient() and setup()
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
   * Load all commands from the file system.
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
        const filePath
          = join(CommandHandler.commandsDirectory, entry);

        if (statSync(filePath).isDirectory()) {
          files = readdirSync(filePath);

          for (const file of files) {
            const module = await import(join(filePath, file));
            this.storeCommand(module.default);
          }

          displayLoaded(`\x1B[35m${entry}\x1B[0m folder`
            + ` (${files.length} commands)`);
        }
      }
    } catch {
      displayWarning("No commands were found.");
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

    const command: BaseCommand = new Command(
      this.client,
      this.todoistClient,
      this.repositories,
    );

    if (command instanceof SlashCommand) {
      this.slashCommands.set(command.getData().name, command);
    } else if (command instanceof MessageCommand) {
      this.messageContextMenuCommands.set(command.getData().name, command);
    } else if (command instanceof UserCommand) {
      this.userContextMenuCommands.set(command.getData().name, command);
    } else {
      throw new TypeError(`Unknown command type for ${command.getData().name}`);
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
    const commands = Array.from(this.getAllSlashCommands().values());

    try {
      displayInfo("Now refreshing (/) commands "
        + (guildId ? `in guild ${guildId}` : "globally")
        + "...");
      await rest.put(
        guildId
          ? Routes.applicationGuildCommands(this.client.user.id, guildId)
          : Routes.applicationCommands(this.client.user.id),
        { body: commands.map(cmd => cmd.getData()) },
      );

      displaySuccess("Application (/) commands reloaded"
        + ` (${commands.length} commands).`);
    } catch (error) {
      displayError(error instanceof Error
        ? `${error.name}: ${error.message}`
        : "Unknown error while refreshing application commands.");
    }
  }

  /**
   * Retrieves a slash command by name.
   * @param commandName name of the command to search
   * @returns the corresponding command object, or undefined if
   *          the command does not exist
   */
  public getSlashCommand(commandName: string): SlashCommand | undefined {
    return this.slashCommands.get(commandName);
  }

  /**
   * Retrieves all of this' slash commands
   * @returns all the handler's slash commands with their name
   */
  public getAllSlashCommands(): Map<string, SlashCommand> {
    return this.slashCommands;
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
   */
  private async handleInteraction(interaction: Interaction): Promise<void> {
    let command: BaseCommand | undefined;
    // TODO fetch user preferred language OR interaction.locale OR default
    const preferredLanguage: Omit<Language, "id">
      = { code: Locale.EnglishUS, name: "English" };

    if (interaction.isChatInputCommand()) {
      command = this.getSlashCommand(interaction.commandName);
    } else if (interaction.isMessageContextMenuCommand()) {
      command = this.messageContextMenuCommands.get(interaction.commandName);
    } else if (interaction.isUserContextMenuCommand()) {
      command = this.userContextMenuCommands.get(interaction.commandName);
    }

    if (interaction.isCommand() && command
      && this.isCommandRunnable(command, interaction, preferredLanguage.code)) {
      await command.execute(interaction, preferredLanguage.code);
    }
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
    const author: GuildMember = interaction.member as GuildMember;
    let isRunnable: boolean = false;
    const botMember = interaction.guild?.members.me;

    if (command.isAdminOnly // private command
      && !this.client?.getConfig().ownerIds.includes(author.id)) {
      interaction.reply({
        content: this.translate(language, "privateCommand"),
        ephemeral: true,
      });
    } else if (!command.hasUserPermission(author)) { // missing user permissions
      const permissionFlags
        = Tickly.permissionsToText(command.userRequiredPermissions);

      interaction.reply({
        content: this.translate(language, "missingPermission.user", {
          required: permissionFlags.map(p => `\`${p}\``).join(", "),
        }),
        ephemeral: true,
      });
    } else if (!command.hasBotPermission(botMember!)) { // missing bot permissions
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
