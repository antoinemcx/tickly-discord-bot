import { join } from "node:path";
import { CommandHandler } from "@bot/handlers/CommandHandler";
import { EventHandler } from "@bot/handlers/EventHandler";
import { TranslationHandler } from "@bot/handlers/TranslationHandler";
import { Tickly } from "@bot/Tickly";
import { DrizzleDatabase } from "@database/DrizzleDatabase";
import { runMigrations } from "@database/migrate";
import { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import { TranslationLoader } from "@services/apiBuilder/TranslationLoader";
import { OAuthApiService } from "@services/oauth/OAuthApiService";
import { OAuthPageRenderer } from "@services/oauth/OAuthPageRenderer";
import { CallbackRoute } from "@services/todoist/oauth/CallbackRoute";
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
  const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME,
  };

  let database: DrizzleDatabase;
  try {
    /* Always migrate the database in production */
    if (process.env.NODE_ENV === "production") {
      await DrizzleDatabase.ensureDatabaseExists(dbConfig);
      await runMigrations(dbConfig);
    }

    database = await DrizzleDatabase.connect(dbConfig);
    await database.initializeBaseData();
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
    new CallbackRoute(
      todoistClient,
      new OAuthPageRenderer(config.oauth.colors),
      new TranslationLoader(join(__dirname, "services", "oauth", "languages")),
    ),
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
  const eventHandler = new EventHandler(todoistClient, repositories);

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
