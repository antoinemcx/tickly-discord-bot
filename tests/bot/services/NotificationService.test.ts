import type { TranslationHandler } from "@bot/handlers/TranslationHandler";
import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import { DmDisabledError, UserNotFoundError } from "@bot/services/NotificationErrors";
import { NotificationService } from "@bot/services/NotificationService";
import { DiscordAPIError, Locale, RESTJSONErrorCodes } from "discord.js";

/**
 * Builds a minimal DiscordAPIError with the given numeric code so that
 * `instanceof DiscordAPIError` checks inside the service still work without
 * needing to satisfy the full constructor signature.
 */
function makeDiscordAPIError(code: number): DiscordAPIError {
  const error = Object.create(DiscordAPIError.prototype) as DiscordAPIError;
  (error as unknown as { code: number }).code = code;
  error.message = `DiscordAPIError[${code}]`;
  return error;
}

const mockMessage = { id: "msg123" };
const mockChannel = { send: jest.fn() };
const mockUser = { createDM: jest.fn() };
const mockClient = {
  users: { fetch: jest.fn() },
  getConfig: jest.fn().mockReturnValue({ defaultSessionRetentionDays: 30 }),
  getCommandMention: jest.fn().mockResolvedValue("</settings:999>"),
} as unknown as Tickly;

const mockUserRepository = {
  getUserSessionRetentionDays: jest.fn(),
};
const mockRepositories = {
  getUserRepository: jest.fn().mockReturnValue(mockUserRepository),
} as unknown as RepositoryFactory;

const mockTranslationHandler = {
  translateNotification: jest.fn(),
} as unknown as TranslationHandler;

let service: NotificationService;

beforeEach(() => {
  jest.clearAllMocks();
  service = new NotificationService(mockClient, mockTranslationHandler, mockRepositories);
  (mockClient.users.fetch as jest.Mock).mockResolvedValue(mockUser);
  (mockUser.createDM as jest.Mock).mockResolvedValue(mockChannel);
  (mockChannel.send as jest.Mock).mockResolvedValue(mockMessage);
  (mockTranslationHandler.translateNotification as jest.Mock).mockImplementation(
    (_locale: Locale, key: string) => `[${key}]`,
  );
  mockUserRepository.getUserSessionRetentionDays.mockResolvedValue(null);
});

describe("NotificationService", () => {
  describe("sendDM", () => {
    it("should return the message ID when the DM is sent successfully", async () => {
      // Arrange
      const payload = { content: "Hello" };

      // Act
      const result = await service.sendDM("user123", payload);

      // Assert
      expect(result).toBe("msg123");
      expect(mockClient.users.fetch).toHaveBeenCalledWith("user123");
      expect(mockUser.createDM).toHaveBeenCalled();
      expect(mockChannel.send).toHaveBeenCalledWith(payload);
    });

    it("should throw DmDisabledError when DMs are disabled", async () => {
      // Arrange
      (mockClient.users.fetch as jest.Mock).mockRejectedValue(
        makeDiscordAPIError(RESTJSONErrorCodes.CannotSendMessagesToThisUser),
      );

      // Act
      const result = service.sendDM("user123", { content: "Hello" });

      // Assert
      await expect(result).rejects.toThrow(DmDisabledError);
      await expect(result).rejects.toMatchObject({ userId: "user123" });
    });

    it("should throw UserNotFoundError when the user does not exist", async () => {
      // Arrange
      (mockClient.users.fetch as jest.Mock).mockRejectedValue(
        makeDiscordAPIError(RESTJSONErrorCodes.UnknownUser),
      );

      // Act
      const result = service.sendDM("user123", { content: "Hello" });

      // Assert
      await expect(result).rejects.toThrow(UserNotFoundError);
      await expect(result).rejects.toMatchObject({ userId: "user123" });
    });

    it("should re-throw other Discord API errors as-is", async () => {
      // Arrange
      const originalError = makeDiscordAPIError(50001); // Missing Access
      (mockClient.users.fetch as jest.Mock).mockRejectedValue(originalError);

      // Act
      const result = service.sendDM("user123", { content: "Hello" });

      // Assert
      await expect(result).rejects.toBe(originalError);
    });

    it("should re-throw non-Discord errors as-is", async () => {
      // Arrange
      const originalError = new Error("Network timeout");
      (mockClient.users.fetch as jest.Mock).mockRejectedValue(originalError);

      // Act
      const result = service.sendDM("user123", { content: "Hello" });

      // Assert
      await expect(result).rejects.toBe(originalError);
    });
  });

  describe("notifyLoginSuccess", () => {
    it("should return the message ID when the DM is sent successfully", async () => {
      // Act
      const result = await service.notifyLoginSuccess("user123", Locale.EnglishUS);

      // Assert
      expect(result).toBe("msg123");
    });

    it("should resolve the notification text from the login.success key", async () => {
      // Act
      await service.notifyLoginSuccess("user456", Locale.French);

      // Assert
      expect(mockTranslationHandler.translateNotification).toHaveBeenCalledWith(
        Locale.French,
        "login.success",
        undefined,
      );
    });

    it("should send the translated text as the message content", async () => {
      // Arrange
      (mockTranslationHandler.translateNotification as jest.Mock).mockImplementation(
        (_locale, key: string) => (key === "login.success" ? "✅ Linked." : `[${key}]`),
      );
      mockUserRepository.getUserSessionRetentionDays.mockResolvedValue(14);

      // Act
      await service.notifyLoginSuccess("user123", Locale.EnglishUS);

      // Assert
      expect(mockChannel.send).toHaveBeenCalledWith({ content: "✅ Linked." });
    });

    it("should append a session retention hint when the user has no custom retention set", async () => {
      // Arrange
      mockUserRepository.getUserSessionRetentionDays.mockResolvedValue(null);

      // Act
      await service.notifyLoginSuccess("user123", Locale.EnglishUS);

      // Assert
      const payload = (mockChannel.send as jest.Mock).mock.calls[0][0] as { content: string };
      expect(payload.content).toContain("\n> ");
      expect(mockTranslationHandler.translateNotification).toHaveBeenCalledWith(
        Locale.EnglishUS,
        "login.session_retention_hint",
        expect.objectContaining({ days: "30", settings: "</settings:999>" }),
      );
    });

    it("should not append the retention hint when the user has a custom retention configured", async () => {
      // Arrange
      mockUserRepository.getUserSessionRetentionDays.mockResolvedValue(7);

      // Act
      await service.notifyLoginSuccess("user123", Locale.EnglishUS);

      // Assert
      const payload = (mockChannel.send as jest.Mock).mock.calls[0][0] as { content: string };
      expect(payload.content).not.toContain("\n>");
      expect(mockTranslationHandler.translateNotification).not.toHaveBeenCalledWith(
        expect.anything(),
        "login.session_retention_hint",
        expect.anything(),
      );
    });

    it("should use the default retention days from config for the hint", async () => {
      // Arrange
      (mockClient.getConfig as jest.Mock).mockReturnValue({ defaultSessionRetentionDays: 60 });
      mockUserRepository.getUserSessionRetentionDays.mockResolvedValue(null);

      // Act
      await service.notifyLoginSuccess("user123", Locale.EnglishUS);

      // Assert
      expect(mockTranslationHandler.translateNotification).toHaveBeenCalledWith(
        Locale.EnglishUS,
        "login.session_retention_hint",
        expect.objectContaining({ days: "60" }),
      );
    });

    it("should propagate DmDisabledError when DMs are disabled", async () => {
      // Arrange
      (mockClient.users.fetch as jest.Mock).mockRejectedValue(
        makeDiscordAPIError(RESTJSONErrorCodes.CannotSendMessagesToThisUser),
      );

      // Act
      const result = service.notifyLoginSuccess("user123", Locale.EnglishUS);

      // Assert
      await expect(result).rejects.toThrow(DmDisabledError);
    });
  });
});
