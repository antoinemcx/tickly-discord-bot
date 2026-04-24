import type { Handler } from "@bot/handlers/Handler";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type { PermissionResolvable } from "discord.js";
import type configurationExample from "../../config.example";
import type { CommandHandler } from "./handlers/CommandHandler";
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
  private readonly eventHandler: Handler;
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
    eventHandler: Handler,
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

  /**
   * Sets up commands and event listeners for the client and logs it
   * into Discord.
   * @return a promise that resolves when the client is logged in
   */
  public async start(): Promise<void> {
    /* Load commands, events and i18n files */
    await this.commandHandler.setup();
    await this.eventHandler.setup();
    await this.translationHandler.setup();

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
        this.reloadStatus(cachedGuildCount);

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
   * @param guildCount amount of guilds the bot is in
   */
  public reloadStatus(guildCount: number): void {
    if (!this.isReady()) {
      throw new Error("The bot must be ready to reload its status.");
    }

    this.user?.setActivity(
      `/help・${guildCount} server${guildCount !== 1 ? "s" : ""}`,
      { type: ActivityType.Watching },
    );
  }

  /**
   * Converts a PermissionResolvable array into a string array.
   * @param permissions the bigint permissions to convert.
   * @returns permissions converted into text.
   */
  public static permissionsToText(permissions: PermissionResolvable[]): string[] {
    return new PermissionsBitField(permissions).toArray();
  }
}
