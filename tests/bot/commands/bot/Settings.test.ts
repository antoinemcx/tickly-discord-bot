import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import Settings from "@bot/commands/bot/Settings";
import { Locale, MessageFlags } from "discord.js";

describe("Settings Command", () => {
  const language = Locale.EnglishUS;
  let command: Settings;
  let clientMock: jest.Mocked<Tickly>;
  let repositoriesMock: jest.Mocked<RepositoryFactory>;
  let userRepositoryMock: any;
  let userSessionRepositoryMock: any;

  beforeEach(() => {
    userRepositoryMock = {
      getUserPreferences: jest.fn().mockResolvedValue({
        language: undefined,
        sessionRetentionDays: null,
      }),
      setUserPreferredLanguage: jest.fn().mockResolvedValue(undefined),
      setUserSessionRetentionDays: jest.fn().mockResolvedValue(undefined),
      deleteUser: jest.fn().mockResolvedValue(undefined),
    };

    userSessionRepositoryMock = {
      deleteSession: jest.fn().mockResolvedValue(undefined),
    };

    clientMock = {
      getTranslationHandler: jest.fn().mockReturnValue({
        translateCommand: (_lang: Locale, _cmd: string, key: string) => key,
        translateCommon: (_lang: Locale, key: string) => key,
        isSupportedLocale: jest.fn().mockReturnValue(true),
        getLocales: jest.fn().mockReturnValue([]),
      }),
      getConfig: jest.fn().mockReturnValue({
        defaultSessionRetentionDays: 30,
        emotes: { languages: {} },
      }),
    } as unknown as jest.Mocked<Tickly>;

    repositoriesMock = {
      getUserRepository: jest.fn().mockReturnValue(userRepositoryMock),
      getUserSessionRepository: jest.fn().mockReturnValue(userSessionRepositoryMock),
    } as unknown as jest.Mocked<RepositoryFactory>;

    command = new Settings(clientMock, {} as TodoistApiClient, repositoriesMock);
  });

  describe("message component handlers", () => {
    it("should register handlers for language, retention, and delete data", () => {
      // Act
      const handlers = command.getMessageComponentHandlers();

      // Assert
      expect(handlers.has("settings:set_language")).toBe(true);
      expect(handlers.has("settings:set_retention")).toBe(true);
      expect(handlers.has("settings:delete_data")).toBe(true);
    });

    it("should register exactly three handlers", () => {
      // Act
      const handlers = command.getMessageComponentHandlers();

      // Assert
      expect(handlers.size).toBe(3);
    });
  });

  describe("execute", () => {
    it("should defer the reply ephemerally", async () => {
      // Arrange
      const interaction = {
        user: { id: "123" },
        deferReply: jest.fn().mockResolvedValue(undefined),
        editReply: jest.fn().mockResolvedValue(undefined),
      } as any;

      // Act
      await command.execute(interaction, language);

      // Assert
      expect(interaction.deferReply).toHaveBeenCalledWith(
        expect.objectContaining({ flags: MessageFlags.Ephemeral }),
      );
    });

    it("should fetch language and retention preferences for the user", async () => {
      // Arrange
      const interaction = {
        user: { id: "456" },
        deferReply: jest.fn().mockResolvedValue(undefined),
        editReply: jest.fn().mockResolvedValue(undefined),
      } as any;

      // Act
      await command.execute(interaction, language);

      // Assert
      expect(userRepositoryMock.getUserPreferences).toHaveBeenCalledWith("456");
    });

    it("should edit the reply with the settings view", async () => {
      // Arrange
      const interaction = {
        user: { id: "123" },
        deferReply: jest.fn().mockResolvedValue(undefined),
        editReply: jest.fn().mockResolvedValue(undefined),
      } as any;

      // Act
      await command.execute(interaction, language);

      // Assert
      expect(interaction.editReply).toHaveBeenCalled();
    });

    it("should reply with fetchError when a repository call fails", async () => {
      // Arrange
      userRepositoryMock.getUserPreferences = jest.fn().mockRejectedValue(
        new Error("DB error"),
      );
      const interaction = {
        user: { id: "123" },
        deferReply: jest.fn().mockResolvedValue(undefined),
        editReply: jest.fn().mockResolvedValue(undefined),
      } as any;

      // Act
      await command.execute(interaction, language);

      // Assert
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: "fetchError" }),
      );
    });
  });

  describe("set_language handler", () => {
    it("should clear the preferred language when default is selected", async () => {
      // Arrange
      const handler = command.getMessageComponentHandlers().get("settings:set_language")!;
      const interaction = {
        user: { id: "123" },
        values: ["default"],
        isStringSelectMenu: jest.fn().mockReturnValue(true),
        replied: false,
        deferred: false,
        reply: jest.fn().mockResolvedValue(undefined),
      } as any;

      // Act
      await handler(interaction, language);

      // Assert
      expect(userRepositoryMock.setUserPreferredLanguage)
        .toHaveBeenCalledWith("123", null);
    });

    it("should set the preferred language when a locale is selected", async () => {
      // Arrange
      const handler = command.getMessageComponentHandlers().get("settings:set_language")!;
      const interaction = {
        user: { id: "123" },
        values: [Locale.French],
        isStringSelectMenu: jest.fn().mockReturnValue(true),
        replied: false,
        deferred: false,
        reply: jest.fn().mockResolvedValue(undefined),
      } as any;

      // Act
      await handler(interaction, language);

      // Assert
      expect(userRepositoryMock.setUserPreferredLanguage)
        .toHaveBeenCalledWith("123", Locale.French);
    });

    it("should not throw when the repository call fails", async () => {
      // Arrange
      userRepositoryMock.setUserPreferredLanguage = jest.fn().mockRejectedValue(
        new Error("DB error"),
      );
      const handler = command.getMessageComponentHandlers().get("settings:set_language")!;
      const interaction = {
        user: { id: "123" },
        values: ["default"],
        isStringSelectMenu: jest.fn().mockReturnValue(true),
      } as any;

      // Act & Assert
      await expect(handler(interaction, language)).resolves.toBeUndefined();
    });
  });

  describe("set_retention handler", () => {
    it("should clear the retention preference when default is selected", async () => {
      // Arrange
      const handler = command.getMessageComponentHandlers().get("settings:set_retention")!;
      const interaction = {
        user: { id: "123" },
        values: ["default"],
        isStringSelectMenu: jest.fn().mockReturnValue(true),
        replied: false,
        deferred: false,
        reply: jest.fn().mockResolvedValue(undefined),
      } as any;

      // Act
      await handler(interaction, language);

      // Assert
      expect(userRepositoryMock.setUserSessionRetentionDays)
        .toHaveBeenCalledWith("123", null);
    });

    it("should set the retention days when a specific duration is selected", async () => {
      // Arrange
      const handler = command.getMessageComponentHandlers().get("settings:set_retention")!;
      const interaction = {
        user: { id: "123" },
        values: ["90"],
        isStringSelectMenu: jest.fn().mockReturnValue(true),
        replied: false,
        deferred: false,
        reply: jest.fn().mockResolvedValue(undefined),
      } as any;

      // Act
      await handler(interaction, language);

      // Assert
      expect(userRepositoryMock.setUserSessionRetentionDays)
        .toHaveBeenCalledWith("123", 90);
    });

    it("should not throw when the repository call fails", async () => {
      // Arrange
      userRepositoryMock.setUserSessionRetentionDays = jest.fn().mockRejectedValue(
        new Error("DB error"),
      );
      const handler = command.getMessageComponentHandlers().get("settings:set_retention")!;
      const interaction = {
        user: { id: "123" },
        values: ["30"],
        isStringSelectMenu: jest.fn().mockReturnValue(true),
      } as any;

      // Act & Assert
      await expect(handler(interaction, language)).resolves.toBeUndefined();
    });
  });

  describe("delete_data handler", () => {
    it("should show the deletion confirmation modal when button is clicked", async () => {
      // Arrange
      const handler = command.getMessageComponentHandlers().get("settings:delete_data")!;
      const interaction = {
        user: { id: "123" },
        isButton: jest.fn().mockReturnValue(true),
        showModal: jest.fn().mockResolvedValue(undefined),
        awaitModalSubmit: jest.fn().mockRejectedValue(new Error("timeout")),
      } as any;

      // Act
      await handler(interaction, language);

      // Assert
      expect(interaction.showModal).toHaveBeenCalled();
    });

    it("should not show modal for non-button interactions", async () => {
      // Arrange
      const handler = command.getMessageComponentHandlers().get("settings:delete_data")!;
      const interaction = {
        user: { id: "123" },
        isButton: jest.fn().mockReturnValue(false),
        showModal: jest.fn(),
      } as any;

      // Act
      await handler(interaction, language);

      // Assert
      expect(interaction.showModal).not.toHaveBeenCalled();
    });
  });
});
