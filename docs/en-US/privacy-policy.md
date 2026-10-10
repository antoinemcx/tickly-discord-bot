# Privacy Policy

**Last updated: September 28, 2026**

Tickly ("the bot", "we", "us") is a Discord bot that connects your Discord account to Todoist.
This policy explains what data we collect, why, and how long we keep it.

## 1. Data We Collect

When you use Tickly, we store the following data in our database:

| Data | Purpose |
|---|---|
| Discord User ID | Identify you and link your preferences and session to your account |
| Language preference | Respond in your preferred language |
| Session retention preference | Honor your configured session expiry setting |
| Todoist access token | Execute Todoist operations on your behalf (getting or creating tasks, etc.) |
| Session timestamps (created, last used) | Manage session lifecycle and expiry |

We do **not** store Discord message content or task content. Task data is sent directly to
Todoist's API and governed by [Todoist's Privacy Policy](https://todoist.com/privacy).

## 2. How We Use Your Data

Your data is used exclusively to provide Tickly's functionality:
- Your Discord User ID links your Todoist session to your Discord account.
- Your access token is used solely to interact with Todoist's API on your behalf.
- No data is sold, shared with third parties for commercial purposes, or used for advertising.

## 3. Data Retention

- **Active sessions** expire after a configurable period of inactivity (default: 30 days).
  You can change this with `/settings`.
- **Pending OAuth sessions** (started but not completed) expire automatically after 15 minutes.
- You can delete your session and access token at any time by running `/todoist logout`.
- To delete all your data (including your user record and Todoist session), use the `/settings`
  command and click "Delete my data", or contact us on
  [GitHub](https://github.com/antoinemcx/tickly-discord-bot/issues) or our
  [support server](https://antoinemcx.fr/discord).

## 4. Third-Party Services

Tickly interacts with the following third-party services:
- **Todoist** — task data is transmitted to Todoist's API.
  See [Todoist's Privacy Policy](https://todoist.com/privacy).
- **Discord** — the bot operates on Discord's platform.
  See [Discord's Privacy Policy](https://discord.com/privacy).

We are not responsible for the data practices of these services.

## 5. Security

Your Todoist access token is encrypted before being stored in our database. This means we cannot read your token in plain text, even with direct database access. This encryption aligns with GDPR data protection requirements.

We take reasonable measures to protect your data, but no system is perfectly secure.

## 6. Limitation of Liability

The bot is provided "as is", without warranty of any kind. The developers of Tickly are not
responsible for:
- any direct or indirect damage caused by the use or inability to use the bot
- tasks content sent through commands, as they are owned by Todoist and created by the user
- downtime or bugs in the use of the bot

For the full disclaimer, see the [GPL-3.0 License](../../LICENSE) (sections 15–16).

## 7. Contact

To report an issue or ask a question about this policy:
- Open an issue on [GitHub](https://github.com/antoinemcx/tickly-discord-bot/issues)
- Join our [support Discord server](https://antoinemcx.fr/discord)
