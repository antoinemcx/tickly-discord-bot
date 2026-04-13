import { CommandHandler } from "@bot/handlers/CommandHandler";
import { Handler } from "@bot/handlers/Handler";
import { TranslationHandler } from "@bot/handlers/TranslationHandler";
import { Tickly } from "@bot/Tickly";
import { DrizzleDatabase } from "@database/DrizzleDatabase";
import { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import { OAuthApiService } from "@services/oauth/OAuthApiService";
import {
  TodoistOAuthRoutesFactory,
} from "@services/todoist/oauth/TodoistOAuthRoutesFactory";
import { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import config from "../config";
import {
  displayDetailedError,
  displayError,
  displayInfo,
  displaySuccess,
} from "./utils/logger";
import "dotenv/config";

(async () => {
  if (!process.env.TODOIST_CLIENT_ID || !process.env.TODOIST_CLIENT_SECRET) {
    displayError("Todoist environment variables must be set.");
    process.exit(1);
  } else if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_NAME) {
    displayError("Database environment variables must be set.");
    process.exit(1);
  } else if (!process.env.DISCORD_CLIENT_TOKEN) {
    displayError("Bot token environment variable must be set.");
    process.exit(1);
  }

  /* Initialize database */
  let database: DrizzleDatabase;
  try {
    database = await DrizzleDatabase.connect({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME,
    });
  } catch (error) {
    displayError((error as Error).message);
    process.exit(1);
  }

  const repositories = new RepositoryFactory(database);

  /* Initialize Todoist utilities */
  const sessionManager = repositories.getUserSessionRepository();
  const todoistClient = new TodoistApiClient(
    process.env.TODOIST_CLIENT_ID,
    process.env.TODOIST_CLIENT_SECRET,
    sessionManager,
    { permissions: ["data:read_write"] },
  );
  const oauthApiService = new OAuthApiService(
    new TodoistOAuthRoutesFactory(todoistClient),
  );

  displayInfo("Starting OAuth callback service...");
  const oAuthServicePort = process.env.OAUTH_SERVICE_PORT
    ? Number.parseInt(process.env.OAUTH_SERVICE_PORT)
    : 3999;

  try {
    await oauthApiService.start(oAuthServicePort);
    displaySuccess(`OAuth callback service started on port ${oAuthServicePort}.\n`);
  } catch (error) {
    displayDetailedError("Failed to start OAuth callback service:", error);
    process.exit(1);
  }

  /* Initialize and start the bot */
  const commandHandler = new CommandHandler(todoistClient, repositories);
  const eventHandler = new (class extends Handler { // TODO
    public async setup(): Promise<void> {}
  })();

  const translationHandler = new TranslationHandler();
  displayInfo("Initializing the bot...\n");
  const bot = new Tickly(
    process.env.DISCORD_CLIENT_TOKEN,
    config,
    todoistClient,
    commandHandler,
    eventHandler,
    translationHandler,
  );

  await bot.start();
})();
