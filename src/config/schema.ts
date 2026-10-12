import { z } from "zod";

/**
 * Zod schema for the Tickly configuration file.
 * Mirrors the structure of config.example.json.
 */
export const configSchema = z.object({
  ownerIds: z.array(z.string()).describe("Owner Discord IDs for admin access"),

  links: z.object({
    supportServer: z.string().url(),
    github: z.string().url(),
    roadmap: z.string().url(),
  }),

  emotes: z.object({
    v: z.string().describe("Checkmark emote"),
    x: z.string().describe("Cross emote"),
    i: z.string().describe("Info emote"),
    warning: z.string().describe("Warning emote"),
    todoist: z.string().describe("Todoist emote"),
    todoistSmall: z.string().describe("Small Todoist emote"),
    priorities: z.object({
      1: z.string(),
      2: z.string(),
      3: z.string(),
      4: z.string(),
    }),
    robot: z.string().describe("Robot emote"),
    languages: z.object({
      "en-US": z.string(),
      "fr": z.string(),
      "pl": z.string(),
      "es-ES": z.string(),
      "de": z.string(),
    }),
  }),

  discordWebhooks: z.object({
    installLogs: z.string().describe("Webhook URL to log bot installs/uninstalls. Leave empty to disable."),
  }),

  oauth: z.object({
    colors: z.object({
      background: z.string().describe("Background color for OAuth page"),
      primary: z.string().describe("Primary color for OAuth page"),
    }),
  }),

  mentionUserInReply: z.boolean().describe("Whether to mention users in replies"),
  defaultLocale: z.string().describe("Default language if no preference"),
  defaultSessionRetentionDays: z.number().int().positive().describe("Default retention period for user sessions in days"),
  enableDailyPrune: z.boolean().describe("Enable the daily session prune task"),
});

export type Configuration = z.infer<typeof configSchema>;
