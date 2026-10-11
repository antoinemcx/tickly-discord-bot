# Tickly — AI Agent Context

Tickly is a TypeScript Discord bot that lets users create and manage Todoist tasks directly from Discord.
Users authenticate per-user via Todoist OAuth, then interact through slash commands and message context menus.

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22+, TypeScript (strict) |
| Discord | discord.js v14 |
| Todoist | @doist/todoist-api-typescript v7 |
| Database | MariaDB via Drizzle ORM |
| HTTP | Express v5 (OAuth callback server) |
| Tests | Jest + ts-jest |

## Architecture

```
src/
├── index.ts                              # process bootstrap
├── bot/
│   ├── Tickly.ts                         # orchestration entry point, startup sequence
│   ├── handlers/                         # CommandHandler (load/dispatch), TranslationHandler (i18n)
│   ├── commands/
│   │   ├── core/                         # base classes: BaseCommand, RegisterableBaseCommand,
│   │   │                                 #   SlashCommand, SubCommand, MessageCommand, UserCommand, ContextMenuCommand
│   │   ├── bot/                          # utility commands: Help, Ping, Settings
│   │   └── todoist/                      # Todoist commands: Login, Logout, task-creation/
│   ├── events/                           # Discord event handlers (GuildCreate, GuildDelete, ThreadCreate)
│   └── languages/                        # i18n JSON files — de/, en-US/, es-ES/, fr/, and pl/ must stay in sync
├── database/
│   ├── DrizzleDatabase.ts
│   ├── schema/                           # Drizzle table definitions
│   ├── migrations/                       # generated migration scripts
│   └── repositories/                     # RepositoryFactory + thin persistence adapters
└── services/
    ├── apiBuilder/                       # generic reusable HTTP building blocks:
    │   │                                 #   ApiRoute (abstract route), ApiService (abstract Express service),
    │   │                                 #   TranslationLoader (JSON locale loader)
    ├── oauth/                            # OAuth result page service: OAuthApiService (extends ApiService),
    │   │                                 #   OAuthPageRenderer (HTML page generator),
    │   │                                 #   languages/ (de, en-US, es-ES, fr, pl), assets/ (static files)
    └── todoist/                          # TodoistApiClient.ts, OAuth flow (CallbackRoute), sessions, errors
```

Tests mirror `src/` under `tests/` and are named `*.test.ts`.

## Key integration points

- **`src/services/todoist/TodoistApiClient.ts`** — single Todoist SDK entry point. Extend it; never bypass it from commands.
- **`src/database/repositories/RepositoryFactory.ts`** — persistence entry point for commands and handlers.
- **`src/bot/handlers/CommandHandler.ts`** — scans `src/bot/commands/` subdirectories, instantiates commands with `(Tickly, TodoistApiClient, RepositoryFactory)`, registers with Discord on `ClientReady`.
- **`src/bot/Tickly.ts`** — loads handlers and translations before login; keep startup order stable.

## Critical rules

- `npm run db:drop` is **destructive** — never run it unless explicitly requested.
- DB migration commands require env vars: `DB_HOST`, `DB_USER`, `DB_NAME` (+ optional `DB_PASSWORD`).
- Todoist OAuth requires: `TODOIST_CLIENT_ID`, `TODOIST_CLIENT_SECRET`.
- All new user-visible text must be added to **every** locale folder under `src/bot/languages/`.
- Both Guild and User Discord install contexts must be supported in every command.
- Path aliases (`@database/*`, `@services/*`, `@src/*`) from `tsconfig.json` — prefer over deep relative imports.

## Common commands

```sh
npm run build          # compile TypeScript
npm test               # run test suite
npm run lint           # ESLint check
npm run lint:fix       # auto-fix ESLint issues
npm run db:migrate     # apply pending migrations
npm run db:generate    # generate migrations from schema changes

# Docker (recommended)
docker compose up -d --build                              # with Traefik
docker compose -f docker-compose.local.yml up -d --build  # without Traefik
```

## Maintaining this file

Update `AGENTS.md` when the project structure, stack, or key integration points change significantly.
For code style or domain-specific rules, update `.github/copilot-instructions.md` or the relevant `.github/instructions/*.instructions.md` file — Kiro picks them up automatically through `.kiro/steering/` and does not need separate updates.

## Detailed guidance

| Topic | File |
|---|---|
| Code style, conventions, gotchas | [.github/copilot-instructions.md](.github/copilot-instructions.md) |
| Bot commands architecture & wiring | [.github/instructions/bot-commands.instructions.md](.github/instructions/bot-commands.instructions.md) |
| Testing conventions | [.github/instructions/testing.instructions.md](.github/instructions/testing.instructions.md) |
| Todoist integration rules | [.github/instructions/todoist-client.instructions.md](.github/instructions/todoist-client.instructions.md) |
| Runtime config examples | [.env.example](.env.example), [config.example.json](config.example.json) |
| User-facing docs | [README.md](README.md), [docs/en-US/getting-started.md](docs/en-US/getting-started.md) |
