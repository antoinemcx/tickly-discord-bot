import type { Tickly } from "@bot/Tickly";
import { readdirSync, readFileSync } from "node:fs";
import { TranslationHandler } from "@bot/handlers/TranslationHandler";
import { Locale } from "discord.js";

jest.mock("node:fs", () => ({
  readFileSync: jest.fn(),
  readdirSync: jest.fn(),
}));

const englishCommon = {
  no: "No",
  interactionHandling: {
    missingPermission: {
      user: "{{x}} You are missing permissions (required : {{required}})",
    },
  },
};
const englishCommands = {
  ping: {
    description: "Displays the bot response time.",
    process: "{{x}} Calculating...",
    result: "Response time is {{time}}ms.",
  },
};
const frenchCommands = {
  ping: {
    description: "Affiche le temps de réponse du bot.",
    process: "{{x}} Calcul...",
    result: "Temps de réponse est {{time}}ms.",
  },
};

function createHandler(
  defaultLocale: Locale | string = Locale.EnglishUS,
): TranslationHandler {
  const handler = new TranslationHandler();
  handler.setClient({
    getConfig: jest.fn().mockReturnValue({
      defaultLocale,
      emotes: { x: "❌" },
    }),
  } as unknown as Tickly);
  return handler;
}

beforeEach(() => {
  jest.clearAllMocks();

  /* Mock files */
  (readdirSync as jest.Mock).mockImplementation((path: string) => {
    const parts = path.split(/[\\/]/);

    if (parts.at(-1) === "languages") {
      return [Locale.EnglishUS, Locale.French]; // mock language directories
    }
    if (parts.includes(Locale.EnglishUS) || parts.includes(Locale.French)) {
      return ["common.json", "commands.json"]; // mock translation files
    }
    return [];
  });

  /* Mock file contents */
  (readFileSync as jest.Mock).mockImplementation((path: string) => {
    const parts = new Set(path.split(/[\\/]/));
    const isEnglish = parts.has(Locale.EnglishUS);
    const isFrench = parts.has(Locale.French);

    if (isEnglish && parts.has("common.json")) {
      return JSON.stringify(englishCommon);
    } else if (isEnglish && parts.has("commands.json")) {
      return JSON.stringify(englishCommands);
    } else if (isFrench && parts.has("common.json")) {
      return JSON.stringify({});
    } else if (isFrench && parts.has("commands.json")) {
      return JSON.stringify(frenchCommands);
    }

    throw new Error(`Unexpected translation file path: ${path}`);
  });
});

describe("TranslationHandler", () => {
  describe("setup", () => {
    it("should load the supported language directories", async () => {
      // Arrange
      const handler = createHandler();
      // Act
      await handler.setup();
      // Assert
      expect(handler.getLocales()).toEqual([Locale.EnglishUS, Locale.French]);
    });

    it("should throw when a language directory is not supported", async () => {
      // Arrange
      (readdirSync as jest.Mock).mockImplementation((path: string) => {
        const parts = path.split(/[\\/]/);
        if (parts.at(-1) === "languages") {
          return ["invalid-locale"];
        }
        return [];
      });
      const handler = createHandler();

      // Act
      const result = handler.setup();

      // Assert
      await expect(result).rejects.toThrow();
    });
  });

  describe("isSupportedLocale", () => {
    it("should return true if a locale is supported", () => {
      // Arrange
      const handler = createHandler();
      // Act
      const result = handler.isSupportedLocale(Locale.EnglishUS);
      // Assert
      expect(result).toBe(true);
    });

    it("should return false if a locale is not supported", () => {
      // Arrange
      const handler = createHandler();
      // Act
      const result = handler.isSupportedLocale("zz-ZZ");
      // Assert
      expect(result).toBe(false);
    });
  });

  describe("getDefaultLocale", () => {
    it("should return the configured locale when it is valid", async () => {
      // Arrange
      const handler = createHandler(Locale.French);
      await handler.setup();

      // Act
      const result = handler.getDefaultLocale();

      // Assert
      expect(result).toBe(Locale.French);
    });

    it("should fall back to the first loaded locale when the configured one is invalid", async () => {
      // Arrange
      const handler = createHandler("de-DE");
      await handler.setup();

      // Act
      const result = handler.getDefaultLocale();

      // Assert
      expect(result).toBe(Locale.EnglishUS);
    });
  });

  describe("translateCommon", () => {
    it("should translate a common entry without parameters", async () => {
      // Arrange
      const handler = createHandler();
      await handler.setup();
      // Act
      const result = handler.translateCommon(Locale.EnglishUS, "no");
      // Assert
      expect(result).toBe("No");
    });

    it("should replace emojis", async () => {
      // Arrange
      const handler = createHandler();
      await handler.setup();

      // Act
      const result = handler.translateCommon(
        Locale.EnglishUS,
        "interactionHandling.missingPermission.user",
      );

      // Assert
      expect(result.startsWith("❌ You are missing permissions")).toBe(true);
    });

    it("should translate a common entry and replace parameters", async () => {
      // Arrange
      const handler = createHandler();
      await handler.setup();

      // Act
      const result = handler.translateCommon(
        Locale.EnglishUS,
        "interactionHandling.missingPermission.user",
        { required: "ManageMessages" },
      );

      // Assert
      expect(result)
        .toBe("❌ You are missing permissions (required : ManageMessages)");
    });

    it("should return a fallback message when the key is missing", async () => {
      // Arrange
      const handler = createHandler();
      await handler.setup();

      // Act
      const result = handler.translateCommon(Locale.EnglishUS, "missing.key");

      // Assert
      expect(result).toBe("Missing translation for missing.key");
    });
  });

  describe("translateCommand", () => {
    it("should translate a command entry with no parameters", async () => {
      // Arrange
      const handler = createHandler();
      await handler.setup();

      // Act
      const result = handler.translateCommand(Locale.EnglishUS, "ping", "process");

      // Assert
      expect(result).toBe("❌ Calculating...");
    });

    it("should translate a command entry and replace parameters", async () => {
      // Arrange
      const handler = createHandler();
      await handler.setup();

      // Act
      const result = handler.translateCommand(
        Locale.EnglishUS,
        "ping",
        "result",
        { time: "123" },
      );

      // Assert
      expect(result).toBe("Response time is 123ms.");
    });

    it("should return a fallback message when the key is missing", async () => {
      // Arrange
      const handler = createHandler();
      await handler.setup();

      // Act
      const result = handler.translateCommand(Locale.EnglishUS, "ping", "missing");

      // Assert
      expect(result).toBe("Missing translation for missing");
    });
  });

  describe("getCommandDescriptions", () => {
    it("should return an empty object if command is not found", async () => {
      // Arrange
      const handler = createHandler();
      await handler.setup();
      // Act
      const result = handler.getCommandDescriptions("nonexistent");
      // Assert
      expect(result).toEqual({});
    });

    it("should return available command descriptions", async () => {
      // Arrange
      const handler = createHandler();
      await handler.setup();

      // Act
      const result = handler.getCommandDescriptions("ping");

      // Assert
      expect(result).toEqual({
        [Locale.EnglishUS]: "Displays the bot response time.",
        [Locale.French]: "Affiche le temps de réponse du bot.",
      });
    });

    it("should omit locales with no descriptions for a command", async () => {
      // Arrange
      (readFileSync as jest.Mock).mockImplementation((path: string) => {
        const parts = new Set(path.split(/[\\/]/));
        const isEnglish = parts.has(Locale.EnglishUS);
        const isCommandsFile = parts.has("commands.json");

        if (isEnglish && isCommandsFile) {
          return JSON.stringify(englishCommands);
        } else if (!isEnglish && isCommandsFile) {
          return JSON.stringify({
            ping: {
              other: "Other text but not the command description",
            },
          });
        }
        return JSON.stringify({});
      });

      const handler = createHandler();
      await handler.setup();

      // Act
      const result = handler.getCommandDescriptions("ping");

      // Assert
      expect(result).toEqual({
        [Locale.EnglishUS]: "Displays the bot response time.",
      }); // no french description included
    });
  });
});
