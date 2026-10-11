import type { Configuration } from "@src/config/schema";
import { configSchema } from "@src/config/schema";

const validConfig: Configuration = {
  ownerIds: ["123456789"],
  links: {
    supportServer: "https://example.com/discord",
    github: "https://github.com/example/repo",
    roadmap: "https://github.com/users/example/projects/1",
  },
  emotes: {
    v: "✅",
    x: "❌",
    i: "ℹ️",
    warning: "⚠️",
    todoist: "🟥",
    todoistSmall: "🟥",
    priorities: { 1: "🔴", 2: "🟠", 3: "🔵", 4: "⚪" },
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
  defaultLocale: "en-US",
  defaultSessionRetentionDays: 30,
  enableDailyPrune: true,
};

describe("configSchema", () => {
  describe("safeParse", () => {
    it("should validate a correct configuration", () => {
      // Arrange
      const input = validConfig;
      // Act
      const result = configSchema.safeParse(input);
      // Assert
      expect(result.success).toBe(true);
    });

    it("should reject when ownerIds is missing", () => {
      // Arrange
      const { ownerIds: _, ...input } = validConfig;
      // Act
      const result = configSchema.safeParse(input);
      // Assert
      expect(result.success).toBe(false);
    });

    it("should reject when links.github is not a valid URL", () => {
      // Arrange
      const input = {
        ...validConfig,
        links: { ...validConfig.links, github: "not-a-url" },
      };
      // Act
      const result = configSchema.safeParse(input);
      // Assert
      expect(result.success).toBe(false);
    });

    it("should reject when emotes.priorities is missing a key", () => {
      // Arrange
      const input = {
        ...validConfig,
        emotes: {
          ...validConfig.emotes,
          priorities: { 1: "🔴", 2: "🟠", 3: "🔵" },
        },
      };

      // Act
      const result = configSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
    });

    it("should reject when defaultSessionRetentionDays is zero", () => {
      // Arrange
      const input = { ...validConfig, defaultSessionRetentionDays: 0 };
      // Act
      const result = configSchema.safeParse(input);
      // Assert
      expect(result.success).toBe(false);
    });

    it("should reject when defaultSessionRetentionDays is not an integer", () => {
      // Arrange
      const input = { ...validConfig, defaultSessionRetentionDays: 30.5 };
      // Act
      const result = configSchema.safeParse(input);
      // Assert
      expect(result.success).toBe(false);
    });

    it("should reject when mentionUserInReply is not a boolean", () => {
      // Arrange
      const input = { ...validConfig, mentionUserInReply: "yes" };
      // Act
      const result = configSchema.safeParse(input);
      // Assert
      expect(result.success).toBe(false);
    });
  });
});

describe("config loader", () => {
  const mockExistsSync = jest.fn();
  const mockReadFileSync = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    jest.doMock("node:fs", () => ({
      existsSync: mockExistsSync,
      readFileSync: mockReadFileSync,
    }));
    mockExistsSync.mockReset();
    mockReadFileSync.mockReset();
  });

  afterEach(() => {
    jest.dontMock("node:fs");
  });

  describe("loadConfig", () => {
    it("should throw when config.json does not exist", async () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);

      // Act & Assert
      await expect(import("@src/config/loader")).rejects.toThrow(
        "Configuration file not found",
      );
    });

    it("should throw when config.json contains invalid JSON", async () => {
      // Arrange
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue("{ invalid json }");

      // Act & Assert
      await expect(import("@src/config/loader")).rejects.toThrow(
        "Failed to parse config.json",
      );
    });

    it("should throw when config.json fails schema validation", async () => {
      // Arrange
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({ ownerIds: "not-an-array" }));

      // Act & Assert
      await expect(import("@src/config/loader")).rejects.toThrow(
        "Invalid configuration",
      );
    });

    it("should export valid configuration", async () => {
      // Arrange
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(validConfig));
      // Act
      const { config } = await import("@src/config/loader");
      // Assert
      expect(config).toEqual(validConfig);
    });

    it("should prefer production path when it exists", async () => {
      // Arrange
      mockExistsSync.mockImplementation((path: string) =>
        path === "/app/build/config.json");
      mockReadFileSync.mockReturnValue(JSON.stringify(validConfig));

      // Act
      await import("@src/config/loader");

      // Assert
      expect(mockReadFileSync).toHaveBeenCalledWith(
        "/app/build/config.json",
        "utf-8",
      );
    });
  });
});
