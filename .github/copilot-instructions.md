# Project Guidelines

## Code Style
- Use TypeScript with strict typing. Keep `strict` and `noImplicitAny` expectations in mind when adding or refactoring code.
- Follow existing naming and structure patterns: PascalCase classes, constructor-based dependency injection, and explicit interfaces/abstract classes for extension points.
- Prefer existing path aliases from `tsconfig.json` (`@database/*`, `@services/*`, `@src/*`) over deep relative imports where possible.
- Favor object-oriented designs aligned with the Todoist TypeScript SDK types and abstractions.
- Code comments must be written in English.
- Use JSDoc blocks with `/** */` for non-trivial public methods: include a short description, `@param`, `@returns`, and `@throws`.
- Document propagated exceptions as well, including unhandled exceptions from Todoist or Discord SDK calls.

## Architecture
- Keep boundaries clear:
  - `src/bot/*`: Discord bot commands, interactions, and integration entry points
  - `src/bot/languages/*`: localization files organized as one folder per language
  - `src/database/*`: Drizzle database access, schema, and repositories
  - `src/services/oauth/*`: OAuth HTTP service and route abstractions
  - `src/services/todoist/*`: Todoist-specific OAuth/session/client logic
  - `src/utils/*`: shared utilities not linked with the business logic (for example logging)
- Repositories should remain thin persistence adapters and keep domain conversion logic local (see `UserSessionRepository`).
- Treat `src/services/todoist/TodoistApiClient.ts` as the single Todoist SDK integration point used by bot commands.
- Prefer architecture decisions that follow industry standards and challenge weak designs when better alternatives exist.
- Prioritize performance-minded implementations and avoid unnecessary allocations, IO calls, and duplicated API roundtrips.

## Build And Test
- Install dependencies: `npm install`
- Build: `npm run build`
- Run tests: `npm test`
- Lint: `npm run lint`
- Auto-fix lint issues: `npm run lint:fix`
- Run migrations: `npm run db:migrate`
- Generate migrations from schema changes: `npm run db:generate`

## Conventions
- Mirror `src/` structure inside `tests/` and name test files `*.test.ts`.
- Mock external services and IO boundaries in tests (database connection layers, API clients, route factories).
- Use domain-specific errors for persistence and OAuth failures instead of throwing generic `Error` directly from domain/infrastructure boundaries.
- Handle Discord/Todoist user IDs carefully where persistence expects bigint-backed values.
- This bot supports Discord server installation and user installation contexts; keep command behavior consistent across slash commands and message context menu flows.
- Any addition or change to translatable text must be reflected in all files under `src/bot/languages/*`.

## External References
- Prefer Todoist TypeScript SDK documentation first: `https://doist.github.io/todoist-sdk-typescript/`.
- If SDK documentation is insufficient, use Todoist REST API documentation: `https://developer.todoist.com/api/v1`.
- For Discord SDK, refer to Discord.js documentation: `https://discord.js.org/docs/packages/discord.js/main`.

## Agent-Critical Gotchas
- Database migration tooling requires environment variables: `DB_HOST`, `DB_USER`, and `DB_NAME` (with optional `DB_PASSWORD`).
- Todoist OAuth flows require `TODOIST_CLIENT_ID` and `TODOIST_CLIENT_SECRET`.
- `npm run db:drop` is destructive; do not run it unless explicitly requested.

## Existing Documentation
- High-level project overview: `README.md`
- Runtime/config examples: `.env.example`, `config.example.js`