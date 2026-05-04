import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import Logout from "@bot/commands/todoist/Logout";
import { UserSessionStatus } from "@services/todoist/sessions/UserSession";
import { Locale } from "discord.js";

describe("Logout Command", () => {
  const language = Locale.EnglishUS;
  let command: Logout;
  let clientMock: Tickly;
  let todoistClientMock: TodoistApiClient;

  beforeEach(() => {
    // Arrange
    clientMock = {
      getTranslationHandler: jest.fn().mockReturnValue({
        translateCommand: (_lang: Locale, _cmd: string, key: string) => key,
      }),
      getCommandMention: jest.fn().mockResolvedValue("/dummy"),
    } as unknown as Tickly;
    todoistClientMock = {} as TodoistApiClient;

    command = new Logout(
      clientMock,
      todoistClientMock,
      {} as RepositoryFactory,
      "todoist",
    );
  });

  it("should have the correct name", () => {
    // Act
    const result = command.getName();
    // Assert
    expect(result).toBe("logout");
  });

  describe("execute", () => {
    it("should send an error message if the user has no session", async () => {
      // Arrange
      const interaction = {
        user: { id: "123" },
        deferReply: jest.fn(),
        editReply: jest.fn(),
      } as any;
      todoistClientMock.getSessionByUserId = jest.fn().mockResolvedValue(undefined);

      // Act
      await command.execute(interaction, language);

      // Assert
      expect(interaction.deferReply).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith({
        content: expect.stringContaining("noSession"),
      });
    });

    it("should send an error message if the user has a pending session", async () => {
      // Arrange
      const interaction = {
        user: { id: "123" },
        deferReply: jest.fn(),
        editReply: jest.fn(),
      } as any;
      todoistClientMock.getSessionByUserId = jest.fn().mockResolvedValue({
        status: UserSessionStatus.Pending,
      });

      // Act
      await command.execute(interaction, language);

      // Assert
      expect(interaction.deferReply).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith({
        content: expect.stringContaining("noSession"),
      });
    });

    it("should clear the user's session and send a success message with an existing session", async () => {
      // Arrange
      const interaction = {
        user: { id: "123" },
        deferReply: jest.fn(),
        editReply: jest.fn(),
      } as any;
      todoistClientMock.getSessionByUserId = jest.fn().mockResolvedValue({
        status: UserSessionStatus.Completed,
      });
      todoistClientMock.clearUserSession = jest.fn().mockResolvedValue(undefined);

      // Act
      await command.execute(interaction, language);

      // Assert
      expect(interaction.deferReply).toHaveBeenCalled();
      expect(todoistClientMock.clearUserSession).toHaveBeenCalledWith("123");
      expect(interaction.editReply).toHaveBeenCalledWith({
        content: expect.stringContaining("logoutSuccess"),
      });
    });

    it("should send an error message if clearing the user's session fails", async () => {
      // Arrange
      const interaction = {
        user: { id: "123" },
        deferReply: jest.fn(),
        editReply: jest.fn(),
      } as any;
      todoistClientMock.getSessionByUserId = jest.fn().mockResolvedValue({
        status: UserSessionStatus.Completed,
      });
      todoistClientMock.clearUserSession
        = jest.fn().mockRejectedValue(new Error("Failed to clear session"));

      // Act
      await command.execute(interaction, language);

      // Assert
      expect(interaction.deferReply).toHaveBeenCalled();
      expect(todoistClientMock.clearUserSession).toHaveBeenCalledWith("123");
      expect(interaction.editReply).toHaveBeenCalledWith({
        content: expect.stringContaining("logoutError"),
      });
    });
  });
});
