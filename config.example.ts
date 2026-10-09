export default {
  ownerIds: [""], // owner discord ids for admin access

  links: {
    supportServer: "https://antoinemcx.fr/discord",
    github: "https://github.com/antoinemcx/tickly-discord-bot",
    roadmap: "https://github.com/users/antoinemcx/projects/3",
  },

  emotes: { // emotes used in the bot (emojis, unicode or discord emotes)
    v: "✅",
    x: "❌",
    i: "ℹ️",
    warning: "⚠️",
    todoist: "🟥",
    todoistSmall: "🟥",
    priorities: {
      1: "",
      2: "",
      3: "",
      4: "",
    },
    robot: "🤖",
    languages: {
      "en-US": "🇺🇸",
      "fr": "🇫🇷",
      "pl": "🇵🇱",
      "es-ES": "🇪🇸",
      "de": "🇩🇪",
    },
  },

  oauth: {
    colors: {
      background: "#fafaf9",
      primary: "#fb2c36",
    },
  },

  mentionUserInReply: true,
  defaultLocale: "en-US", // default language if no preference (see https://docs.discord.com/developers/reference#locales)
  defaultSessionRetentionDays: 30, // default retention period for user sessions (in days)
  enableDailyPrune: true, // true to enable the daily session prune task
};

// Made with ❤️ by antoinemcx (https://github.com/antoinemcx)
