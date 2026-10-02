import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type { PermissionResolvable } from "discord.js";
import type configurationExample from "../../config.example";
import type { SlashCommand } from "./commands/core/SlashCommand";
import type { CommandHandler } from "./handlers/CommandHandler";
import type { EventHandler } from "./handlers/EventHandler";
import type { TranslationHandler } from "./handlers/TranslationHandler";
import { displayCustom, displayInfo, displaySuccess, pink } from "@src/utils/logger";
import {
  ActivityType,
  AllowedMentionsTypes,
  Client,
  Events,
  GatewayIntentBits,
  PermissionsBitField,
} from "discord.js";

export type Configuration = typeof configurationExample;

/**
 * Discord application and unofficial Todoist integration for Discord
 * that interacts with the Discord API, using (/) commands and context
 * menus from guild or user installations.
 */
export class Tickly extends Client {
  private readonly config: Configuration;
  private readonly todoistClient: TodoistApiClient;
  private readonly commandHandler: CommandHandler;
  private readonly eventHandler: EventHandler;
  private readonly translationHandler: TranslationHandler;

  /**
   * Initializes a new bot and creates its Discord client.
   * It also injects the bot instance to the handlers so they can access
   * the client and its business repositories.
   *
   * @param token the bot token from the Discord Developer Portal
   * @param config the bot settings (version, owner ids, etc.)
   * @param todoistClient the Todoist API wrapper to be used for commands
   * @param commandHandler the handler for processing commands
   * @param eventHandler the handler for processing events
   * @param translationHandler the handler for processing translations
   *
   * @throws {ReferenceError} if the bot token is missing in the config
   */
  constructor(
    token: string,
    config: Configuration,
    todoistClient: TodoistApiClient,
    commandHandler: CommandHandler,
    eventHandler: EventHandler,
    translationHandler: TranslationHandler,
  ) {
    if (!token) {
      throw new ReferenceError("Missing bot token in the configuration.");
    }

    super({ // client options
      allowedMentions: {
        parse: [AllowedMentionsTypes.User],
        repliedUser: config.mentionUserInReply,
      },
      intents: [
        GatewayIntentBits.Guilds, // mainly for THREAD_CREATE event
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
      ],
    });

    this.token = token;
    this.config = config;
    this.todoistClient = todoistClient;
    this.commandHandler = commandHandler;
    this.eventHandler = eventHandler;
    this.translationHandler = translationHandler;

    /* Inject the bot instance to the handlers */
    this.commandHandler.setClient(this);
    this.eventHandler.setClient(this);
    this.translationHandler.setClient(this);
  }

  /** @returns the settings of this */
  public getConfig() {
    return this.config;
  }

  /** @returns the translation handler of this */
  public getTranslationHandler() {
    return this.translationHandler;
  }

  public getSlashCommands(): Map<string, SlashCommand> {
    return this.commandHandler.getSlashCommands();
  }

  /**
   * Retrieves a slash command by its name.
   * @param commandName the command name
   * @returns the matching command, or undefined when the path is unknown
   */
  public getSlashCommandByName(commandName: string): SlashCommand | undefined {
    const rootCommandName = commandName.trim().split(" ")[0];
    if (!rootCommandName) {
      return undefined;
    }

    const registerableCommands = this.commandHandler.getSlashCommands();
    return registerableCommands.get(rootCommandName);
  }

  /**
   * Sets up commands and event listeners for the client and logs it
   * into Discord.
   * @return a promise that resolves when the client is logged in
   */
  public async start(): Promise<void> {
    /* Load commands, events and i18n files */
    await this.translationHandler.setup();
    await this.commandHandler.setup();
    await this.eventHandler.setup();

    console.log("");
    displayInfo("Logging into Discord...");
    await this.login(this.token!);
    displaySuccess(`Logged in successfully as '${this.user?.username}'.\n`);

    await new Promise<void>((resolve) => {
      this.once(Events.ClientReady, async () => {
        const fetchedApplication = await this.application?.fetch();
        const cachedGuildCount = this.guilds.cache.size;
        const guildInstallCount = fetchedApplication?.approximateGuildCount;
        const userInstallCount = fetchedApplication?.approximateUserInstallCount;

        /* Register slash commands after the bot is ready */
        await this.commandHandler.registerCommands(this.token!, null);
        await this.reloadStatus(guildInstallCount ?? 0, userInstallCount ?? 0);

        console.log("");
        displaySuccess(`\x1B[32m'${this.user?.username}'`
          + " is ready to serve !\x1B[0m 🚀");
        displayCustom(" ㄴ Approximate guilds: " + pink(guildInstallCount)
          + ` (${cachedGuildCount} cached)`);
        displayCustom(` ㄴ Approximate user installs: ${pink(userInstallCount)}\n`);
        resolve();
      });
    });
  }

  /**
   * Load or reload the discord activity of this.
   * If no guild and user counts are provided, it will fetch the current
   * approximate counts from the Discord API.
   *
   * @param guildCount amount of guilds the bot is in
   * @param userCount amount of users the bot is installed for
   */
  public async reloadStatus(guildCount?: number, userCount?: number): Promise<void> {
    if (!this.isReady()) {
      throw new Error("The bot must be ready to reload its status.");
    }
    if (guildCount === undefined || userCount === undefined) {
      const fetchedApplication = await this.application?.fetch();
      guildCount = fetchedApplication?.approximateGuildCount
        ?? this.guilds.cache.size;
      userCount = fetchedApplication?.approximateUserInstallCount ?? 0;
    }

    const userCountText
      = userCount === 1 ? "1 user" : `${userCount.toLocaleString("en-US")} users`;
    const guildCountText
      = guildCount === 1 ? "1 guild" : `${guildCount.toLocaleString("en-US")} guilds`;

    this.user?.setActivity(
      `/help・${userCountText}, ${guildCountText}`,
      { type: ActivityType.Watching },
    );
  }

  /** @returns the link to invite the bot (user install or guild install) */
  public getInviteLink(): string {
    return "https://discord.com/oauth2/authorize?client_id="
      + this.application?.id;
  }

  /**
   * Generates a mention string for a command, using its name and optionally
   * its guild ID if it's a guild command.
   * If the command cannot be found, it falls back to a simple slash command format.
   *
   * @param commandName the name of the command to mention
   * @param guildId the ID of the guild to look in, if applicable
   * @returns a string that mentions the command in Discord
   */
  public async getCommandMention(commandName: string, guildId?: string): Promise<string> {
    let mention = `\`/${commandName}\``;
    if (!this.application) {
      return mention;
    }

    try {
      const commands = await this.application.commands.fetch({ guildId });
      const command = commands.find(cmd =>
        cmd.name === commandName.split(" ")[0]);
      if (command) {
        mention = `</${commandName}:${command.id}>`;
      }
    } catch {
      // Do nothing, just return the fallback mention
    }
    return mention;
  }

  /**
   * Strips inline Markdown link syntax from content and escapes Discord markdown
   * characters for safe use as masked link text inside Components v2 TextDisplay.
   *
   * Backslash escapes are not honored inside masked link text by Discord's
   * TextDisplay renderer, so `[text](url)` patterns must be stripped first
   * (link text is kept, URL is discarded) before escaping the remaining chars.
   *
   * @param content raw text to escape
   * @returns content safe to embed inside `[content](url)` in a TextDisplay
   */
  public static escapeMarkdownLinkText(content: string): string {
    const stripped = content.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
    return stripped
      .replace(/\\/g, "\\\\")
      .replace(/\*/g, "\\*")
      .replace(/_/g, "\\_")
      .replace(/`/g, "\\`")
      .replace(/\[/g, "\\[")
      .replace(/\]/g, "\\]")
      .replace(/~/g, "\\~");
  }

  /**
   * Formats a date string into a Discord timestamp with the short date/time style.
   * @param dateString the date string to parse (e.g. "2026-05-21")
   * @param displayTime whether to include the time in the output (defaults to false)
   * @returns the Discord timestamp string, or null if the date is invalid
   */
  public static dateStringToDiscordTimestamp(
    dateString: string,
    displayTime: boolean = false,
  ): string | null {
    const timestamp = Math.floor(new Date(dateString).getTime() / 1000);
    if (Number.isNaN(timestamp)) {
      return null;
    }
    return `<t:${timestamp}:${displayTime ? "f" : "D"}>`;
  }

  /**
   * Converts a PermissionResolvable array into a string array.
   * @param permissions the bigint permissions to convert.
   * @returns permissions converted into text.
   */
  public static permissionsToText(permissions: PermissionResolvable[]): string[] {
    return permissions.length === 0
      ? []
      : new PermissionsBitField(permissions).toArray();
  }
}
