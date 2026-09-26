# Project Guidelines

## Code Style
- Use TypeScript with strict typing. Keep strict and noImplicitAny expectations in mind when adding or refactoring code.
- Follow existing naming and structure patterns: PascalCase classes, constructor-based dependency injection, and explicit interfaces or abstract classes for extension points.
- Prefer existing path aliases from tsconfig.json (@database/*, @services/*, @src/*) over deep relative imports where possible.
- Favor object-oriented designs aligned with the Todoist TypeScript SDK types and abstractions.
- Code comments must be written in English.
- Use JSDoc blocks with /** */ for non-trivial public methods: include a short description, @param, @returns, and @throws.
- Document propagated exceptions as well, including unhandled exceptions from Todoist or Discord SDK calls.
- Do not use `break` or `continue` inside loops.

## Change Scope
- Do not modify existing code unless it directly impacts the requested feature or fixes related bugs.
- Avoid refactoring, style improvements, or restructuring in areas not involved in the current request.
- Keep changes focused and minimal to reduce risk of unintended side effects.

## Architecture
- Keep boundaries clear:
  - src/bot/*: Discord bot commands, interactions, and integration entry points
    - src/bot/commands/core/: base classes for all command types (BaseCommand, SlashCommand, SubCommand, ContextMenuCommand, …)
    - src/bot/commands/<category>/<CommandName>.ts: individual command implementations organized by category
    - src/bot/events/*: Discord event handlers (GuildCreate, GuildDelete, ThreadCreate, …)
    - src/bot/languages/*: localization files organized as one folder per language
  - src/database/*: Drizzle database access, schema, and repositories
  - src/services/apiBuilder/*: generic reusable HTTP primitives (ApiRoute, ApiService, TranslationLoader) — shared across services
  - src/services/oauth/*: OAuth result pages — OAuthApiService (extends ApiService), OAuthPageRenderer, locale JSON files, static assets
  - src/services/todoist/*: Todoist-specific OAuth/session/errors/client logic; CallbackRoute lives in todoist/oauth/
  - src/utils/*: shared utilities not linked with business logic (for example logging)
- Repositories should remain thin persistence adapters and keep domain conversion logic local (see src/database/repositories/UserSessionRepository.ts).
- Treat src/services/todoist/TodoistApiClient.ts as the single Todoist SDK integration point used by bot commands.
- Prefer architecture decisions that follow industry standards and challenge weak designs when better alternatives exist.
- Prioritize performance-minded implementations and avoid unnecessary allocations, IO calls, and duplicated API roundtrips.

## Bot Development
For detailed guidance on implementing, registering, and localizing Discord commands, see [bot-commands.instructions.md](./instructions/bot-commands.instructions.md).

## Build And Test
- Install dependencies: npm install
- Build: npm run build
- Run tests: npm test
- Lint: npm run lint
- Auto-fix lint issues: npm run lint:fix
- Run migrations: npm run db:migrate
- Generate migrations from schema changes: npm run db:generate

## Conventions
- Mirror src/ structure inside tests/ and name test files *.test.ts.
- Mock external services and IO boundaries in tests (database connection layers, API clients, HTTP route handlers).
- Use domain-specific errors for persistence and OAuth failures instead of throwing generic Error directly from domain or infrastructure boundaries.
- Handle Discord and Todoist user IDs carefully where persistence expects bigint-backed values.
- This bot supports Discord server installation and user installation contexts; keep command behavior consistent across slash commands and message context menu flows.
- Any addition or change to translatable text must be reflected in all files under src/bot/languages/*.

## External References
- Prefer Todoist TypeScript SDK documentation first: https://doist.github.io/todoist-sdk-typescript/
- If SDK documentation is insufficient, use Todoist REST API documentation: https://developer.todoist.com/api/v1
- For Discord SDK, refer to Discord.js documentation: https://discord.js.org/docs/packages/discord.js/main

## Agent-Critical Gotchas
- Database migration tooling requires environment variables: DB_HOST, DB_USER, and DB_NAME (with optional DB_PASSWORD).
- Todoist OAuth flows require TODOIST_CLIENT_ID and TODOIST_CLIENT_SECRET.
- npm run db:drop is destructive; do not run it unless explicitly requested.
- Use `docker compose up -d --build` (default, with Traefik) or `docker compose -f docker-compose.local.yml up -d --build` (without Traefik, no external network required).

## Maintaining AI Documentation
- When adding or updating AI guidance rules, write them here (copilot-instructions.md) or in the relevant `.github/instructions/*.instructions.md` file. Kiro picks them up automatically through its steering files via `#[[file:...]]` references — do not duplicate rules in `.kiro/steering/`.
- When the project structure, stack, or key integration points change significantly, update `AGENTS.md` at the repo root to keep it accurate.
- The `.kiro/steering/` files are pure redirections and should rarely need to change.

## Existing Documentation
- High-level AI-facing overview (architecture map, critical rules): [AGENTS.md](../AGENTS.md)
- High-level project overview: [README.md](../README.md)
- Runtime and config examples: [.env.example](../.env.example), [config.example.ts](../config.example.ts)
- Docker Compose variants: [docker-compose.yml](../docker-compose.yml) (with Traefik), [docker-compose.local.yml](../docker-compose.local.yml) (local, no Traefik)
- Getting started workflow: [docs/getting-started.md](../docs/getting-started.md)
- Testing rules: [.github/instructions/testing.instructions.md](./instructions/testing.instructions.md)
- Todoist integration rules: [.github/instructions/todoist-client.instructions.md](./instructions/todoist-client.instructions.md)
