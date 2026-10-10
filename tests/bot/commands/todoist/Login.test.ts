import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import Login from "@bot/commands/todoist/Login";
import { UserSessionStatus } from "@services/todoist/sessions/UserSession";
import { Locale } from "discord.js";

describe("Login Command", () => {
  const language = Locale.EnglishUS;
  let command: Login;
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

    command = new Login(
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
    expect(result).toBe("login");
  });

  describe("execute", () => {
    it("should send an error message if the user already has a completed session", async () => {
      // Arrange
      const interaction = {
        user: { id: "123" },
        deferReply: jest.fn(),
        editReply: jest.fn(),
      } as any;
      todoistClientMock.getSessionByUserId = jest.fn().mockResolvedValue({
        status: UserSessionStatus.Completed,
        accessToken: "valid-token",
      });

      // Act
      await command.execute(interaction, language);

      // Assert
      expect(interaction.deferReply).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith({
        content: expect.stringContaining("alreadyLoggedIn"),
      });
    });

    it("should send a new authorization URL if session is completed but accessToken is null (corrupted)", async () => {
      // Arrange
      const userId = "123";
      const authUrl = "https://todoist.com/oauth/authorize?client_id=abc";
      const interaction = {
        user: { id: userId },
        deferReply: jest.fn(),
        editReply: jest.fn(),
      } as any;
      todoistClientMock.getSessionByUserId = jest.fn().mockResolvedValue({
        status: UserSessionStatus.Completed,
        accessToken: null, // corrupted token
      });
      todoistClientMock.createOAuthAuthorizationUrl
        = jest.fn().mockResolvedValue(authUrl);

      // Act
      await command.execute(interaction, language);

      // Assert
      expect(todoistClientMock.createOAuthAuthorizationUrl)
        .toHaveBeenCalledWith(userId, language);

      const editArg = (interaction.editReply as jest.Mock).mock.calls[0][0];
      expect(editArg.content).toEqual(expect.stringContaining("instructions"));
    });

    it("should send a message with a new authorization URL if the user does not have one", async () => {
      // Arrange
      const userId = "123";
      const authUrl = "https://todoist.com/oauth/authorize?client_id=abc";
      const interaction = {
        user: { id: userId },
        deferReply: jest.fn(),
        editReply: jest.fn(),
      } as any;
      todoistClientMock.getSessionByUserId = jest.fn().mockResolvedValue(undefined);
      todoistClientMock.createOAuthAuthorizationUrl
        = jest.fn().mockResolvedValue(authUrl);

      // Act
      await command.execute(interaction, language);

      // Assert
      expect(todoistClientMock.createOAuthAuthorizationUrl)
        .toHaveBeenCalledWith(userId, language);

      const editArg = (interaction.editReply as jest.Mock).mock.calls[0][0];
      expect(editArg.content).toEqual(expect.stringContaining("instructions"));
      expect(Array.isArray(editArg.components)).toBe(true);
      const editButton = editArg.components[0].components[0];
      const editBtnJson = typeof editButton.toJSON === "function"
        ? editButton.toJSON()
        : editButton;
      expect(editBtnJson.url).toBe(authUrl);
    });

    it("should warn the user if they have a pending session but still send a new auth URL", async () => {
      // Arrange
      const userId = "123";
      const authUrl = "https://todoist.com/oauth/authorize?client_id=abc";
      const interaction = {
        user: { id: userId },
        deferReply: jest.fn(),
        editReply: jest.fn(),
        followUp: jest.fn(),
      } as any;
      todoistClientMock.getSessionByUserId = jest.fn().mockResolvedValue({
        status: UserSessionStatus.Pending,
        expiresAt: new Date(Date.now() + 1000 * 120),
      });
      todoistClientMock.createOAuthAuthorizationUrl
        = jest.fn().mockResolvedValue(authUrl);

      // Act
      await command.execute(interaction, language);

      // Assert
      expect(todoistClientMock.createOAuthAuthorizationUrl)
        .toHaveBeenCalledWith(userId, language);

      expect(interaction.editReply).toHaveBeenCalledWith({
        content: expect.stringContaining("existingPendingSession"),
      });

      const followArg = (interaction.followUp as jest.Mock).mock.calls[0][0];
      expect(followArg.content).toEqual(expect.stringContaining("instructions"));
      expect(Array.isArray(followArg.components)).toBe(true);
      const followButton = followArg.components[0].components[0];
      const followBtnJson = typeof followButton.toJSON === "function"
        ? followButton.toJSON()
        : followButton;
      expect(followBtnJson.url).toBe(authUrl);
    });
  });
});
