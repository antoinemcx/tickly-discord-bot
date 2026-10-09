---
description: "Use when adding, modifying, or reviewing Discord bot commands. Enforces command architecture, startup wiring, interaction handling, localization, and repository usage patterns."
name: "Bot Commands Guidelines"
applyTo: ["src/bot/commands/**/*.ts", "src/bot/languages/**/*.json", "src/bot/handlers/CommandHandler.ts"]
---
# Bot Commands Guidelines

## Startup and wiring order
- src/bot/Tickly.ts is the orchestration entry point for bot runtime behavior.
- Tickly.start() loads command, event, and translation handlers before login, then registers commands on ClientReady through CommandHandler.
- Keep this order stable when changing startup logic to avoid missing translations or unregistered commands.

## Command loading and execution flow
- src/bot/handlers/CommandHandler.ts scans subdirectories under src/bot/commands, imports command classes, and instantiates them with Tickly, TodoistApiClient, and RepositoryFactory dependencies.
- Interactions are dispatched by type (slash, message context menu, user context menu), then permission checks run before execute().
- New commands must keep constructor injection compatible with this loader: constructor(client: Tickly, todoistClient: TodoistApiClient, repositories: RepositoryFactory).

## Command class responsibilities
- src/bot/commands/core/BaseCommand.ts defines the shared runtime behavior for commands and subcommands, including translation access and option ordering helpers.
- src/bot/commands/core/RegisterableBaseCommand.ts centralizes the metadata shared by registerable Discord application commands (slash, message context menu, user context menu).
- src/bot/commands/core/SlashCommand.ts is responsible for slash-command description localization via TranslationHandler and for merging its SubCommand options into the final registration payload.
- src/bot/commands/core/SubCommand.ts models a slash-command option of type subcommand and must keep its translation namespace aligned with its parent slash command.
- src/bot/commands/core/MessageCommand.ts (and similarly UserCommand) must not include description fields because Discord context menu commands do not allow them.

## Localization workflow
- src/bot/handlers/TranslationHandler.ts loads locale folders from src/bot/languages and reads JSON translation files into memory.
- Locale resolution in interaction handling follows this order: user preference from repositories → interaction locale → default locale fallback.
- Command text belongs in src/bot/languages/<locale>/commands.json and shared text in src/bot/languages/<locale>/common.json.
- Any new or changed translation key must be synchronized across every locale folder (currently de, en-US, es-ES, fr, and pl).
- Placeholders in translation strings use {{parameterName}} syntax and are replaced at runtime.

## Repository usage from bot code
- Use src/database/repositories/RepositoryFactory.ts to access persistence adapters from commands and handlers.
- Keep repositories in src/database/repositories as persistence-focused adapters; avoid leaking command or transport concerns into repositories.

## Safe extension checklist for new bot features
- Add or update command implementation in src/bot/commands/<category>/.
- Keep command metadata aligned with command type constraints: slash commands can have descriptions and nested subcommands; context menu commands cannot have descriptions.
- Use RegisterableBaseCommand only for commands that CommandHandler should register with Discord; do not treat SubCommand as a standalone registerable command.
- Add translation keys in src/bot/languages/de, src/bot/languages/en-US, src/bot/languages/es-ES, src/bot/languages/fr, and src/bot/languages/pl.
- If user preference or session data is needed, integrate through RepositoryFactory repositories rather than ad-hoc database access.
- Verify command registration behavior after startup changes by checking logs for loaded command count.

## Message component interactions (buttons, select menus, etc.)
- BaseCommand exposes a registration API for handling component interactions (buttons, select menus, modals) scoped to a command.
- Use `this.onMessageComponent(action, handler)` in the command constructor to register a handler. The `action` is a short string identifier; the full customId is built automatically as `"commandName:action"` via `buildComponentId()`.
- When building a component (e.g. ButtonBuilder), set its customId with `this.buildComponentId(action)` to match the registered handler.
- Handler signature: `(interaction: MessageComponentInteraction, language: Locale) => Promise<void>`. The language is resolved by CommandHandler the same way as for slash commands.
- CommandHandler collects all component handlers at startup via `collectComponentHandlers()`, which iterates over every registerable command and its subcommands, storing handlers in a central `messageComponentHandlers` map.
- Dispatching: when an interaction is a message component (`interaction.isMessageComponent()`), CommandHandler looks up the handler by `interaction.customId` in the central map and invokes it. Errors are caught and logged.
- Subcommands can also register component handlers; they are collected from `SlashCommand.getSubCommands()` during startup.
- Action identifiers must be unique per command name; collisions across commands are naturally avoided by the `"commandName:action"` namespacing.
- Keep handler logic in the command class (or delegate to private methods) to maintain colocation with the command's execute() flow.
- Example pattern (from Help command):
  ```ts
  private static readonly MY_ACTION = "my_action";

  constructor(client, todoistClient, repositories) {
    super(client, todoistClient, repositories);
    this.onMessageComponent(Help.MY_ACTION, async (interaction, language) => {
      // handle the component interaction
    });
  }

  // In execute() or response builders:
  new ButtonBuilder()
    .setCustomId(this.buildComponentId(Help.MY_ACTION))
    .setLabel(this.translate(language, "buttons.myButton"))
    .setStyle(ButtonStyle.Primary);
  ```

## Pitfalls and constraints
- Command loading is recursive: subdirectories in src/bot/commands/ are scanned; non-directory entries are skipped.
- Commands must have a constructor with the exact signature above; no-arg constructors will fail during storeCommand().
- Subcommands are instantiated by slash commands and should not be picked up by CommandHandler as top-level commands.
- Translation keys must exist in all supported locales; missing translations log warnings but do not crash.
- User preferred language is queried on every interaction, so ensure getUserPreferredLanguage() handles missing users gracefully.
- Context menu commands cannot have descriptions; remove description and description_localizations from data for Message/User commands.
- Both guild and user installations are supported; commands must declare integration_types: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall].
- Exceptions in execute() are caught by CommandHandler; reply with error code is automatic.
