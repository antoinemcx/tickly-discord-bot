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
