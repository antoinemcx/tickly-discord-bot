This document describes the configuration options available in `config.json`.

## Setup

1. Copy `config.example.json` to `config.json` at the project root
2. Edit the values according to your needs
3. In Docker production, `config.json` is mounted as a volume into the container

## Encryption Key

The `TOKEN_ENCRYPTION_KEY` environment variable (in `.env`) must be a 32-byte key encoded in base64. Generate one with:

| OS | Command |
|---|---|
| Linux / macOS | `openssl rand -base64 32` |
| Windows (PowerShell) | `[Convert]::ToBase64String([byte[]](1..32 \| ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))` |

## Database migrations

At startup, the project automatically runs any pending database migrations so the schema is always up to date.  
This behaviour is controlled by a single environment variable (set in `.env`): `AUTO_MIGRATE`

When `AUTO_MIGRATE` is unset or set to any value other than `false`, migrations run on every startup.  
They are idempotent, so re-running them on an already up-to-date schema is harmless.

Disabling automatic migrations is useful if you manage migrations separately (e.g. in a CI/CD step) or want to skip that step for local development.  
You can still run migrations manually at any time:
```sh
npm run db:migrate
```

## Redis cache

Redis is used as an optional caching layer. The following environment variables control it (set in `.env`):

| Variable | Required | Default | Description |
|---|---|---|---|
| `REDIS_HOST` | No | *(unset)* | Hostname of the Redis server. Use `redis` when the node server runs inside Docker, or `localhost` otherwise. Leave unset to disable caching. |
| `REDIS_PORT` | No | `6379` | Port of the Redis server. |
| `REDIS_PASSWORD` | No | *(none)* | Password for Redis authentication. Leave empty if your Redis instance has no password. |

### Memory limits

In Docker deployments, Redis is started with `--maxmemory` (32 MB for local Docker, 64 MB for production) and the `allkeys-lru` eviction policy. This means the least-recently-used keys are evicted automatically when memory is full.

### Graceful degradation

If `REDIS_HOST` is not set, or if the Redis server is unreachable at startup, caching is silently disabled and the bot falls back to reading tokens directly from the database. The bot will not crash or refuse to start.

## config.json parameters

### `ownerIds`
Array of Discord user IDs for admin access. Owners can use bot management commands.

### `links`
URLs displayed in bot responses and help commands. We recommand to keep the default values.

### `emotes`
Emotes used in bot messages. Can be Unicode emojis or Discord custom emotes (format: `<:name:id>`).

| Key | Description |
|-----|-------------|
| `v` | Success |
| `x` | Error |
| `i` | Info |
| `warning` | Warning |
| `todoist` | Todoist branding |
| `todoistSmall` | Small Todoist branding (more used) |
| `priorities.1` to `priorities.4` | Todoist task priority flags (1 = highest) |
| `robot` | Robot emote |
| `languages.*` | Flag emotes for each supported locale |

### `discordWebhooks`
[Discord webhooks](https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks) used for logging events.

| Key | Description |
|-----|-------------|
| `installLogs` | Webhook URL to log when the bot is installed or uninstalled from a server. Leave empty to disable. |

### `oauth`
OAuth success and error pages appearance settings. Must be hex colors.

| Key | Description |
|-----|-------------|
| `colors.background` | Background color |
| `colors.primary` | Primary/accent color |

### `mentionUserInReply`
Whether to mention users when replying to their commands.

### `defaultLocale`
Default language if no user preference is set.  
Must be a [Discord locales](https://docs.discord.com/developers/reference#locales) supported by Tickly.

### `defaultSessionRetentionDays`
Default retention period for user sessions in days.

### `enableDailyPrune`
Set to `true` to enable the daily session prune task with `node-cron`.
