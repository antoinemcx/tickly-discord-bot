import type { TaskAddModalData } from "@bot/commands/todoist/task-creation/TaskAddModal";
import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApi } from "@doist/todoist-api-typescript";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import TaskAddFromMessage from "@bot/commands/todoist/task-creation/TaskAddFromMessage";
import { ModalCancelledError, TaskAddHandler } from "@bot/commands/todoist/task-creation/TaskAddHandler";
import { Locale, MessageFlags } from "discord.js";

jest.mock("@bot/commands/todoist/task-creation/TaskAddHandler");
jest.mock("@src/utils/logger", () => ({
  displayDetailedError: jest.fn(),
  generateErrorCode: jest.fn().mockReturnValue("ERR-123"),
}));

describe("TaskAddFromMessage Command", () => {
  const language = Locale.EnglishUS;
  let command: TaskAddFromMessage;
  let clientMock: Tickly;
  let todoistClientMock: TodoistApiClient;
  let mockSendAndAwaitModalSubmit: jest.Mock;
  let mockAddToTodoist: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    clientMock = {
      getTranslationHandler: jest.fn().mockReturnValue({
        translateCommand: (_lang: Locale, _cmd: string, key: string) => key,
        translateCommon: (_lang: Locale, key: string) => key,
      }),
      getCommandMention: jest.fn().mockResolvedValue("/todoist login"),
      getConfig: jest.fn().mockReturnValue({ emotes: {
        priorities: { 1: "p1", 2: "p2", 3: "p3", 4: "p4" },
      } }),
    } as unknown as Tickly;

    todoistClientMock = {
      getUserApi: jest.fn(),
    } as unknown as TodoistApiClient;

    mockSendAndAwaitModalSubmit = jest.fn();
    mockAddToTodoist = jest.fn();
    (TaskAddHandler as jest.MockedClass<typeof TaskAddHandler>)
      .mockImplementation(() => ({
        sendAndAwaitModalSubmit: mockSendAndAwaitModalSubmit,
        addToTodoist: mockAddToTodoist,
      }) as any);

    command = new TaskAddFromMessage(
      clientMock,
      todoistClientMock,
      {} as RepositoryFactory,
    );
  });

  describe("execute", () => {
    it("should reply with session error when getUserApi throws", async () => {
      // Arrange
      const interaction = {
        user: { id: "123" },
        reply: jest.fn(),
        targetMessage: { content: "Some message" },
      } as any;
      (todoistClientMock.getUserApi as jest.Mock)
        .mockRejectedValue(new Error("No token"));

      // Act
      await command.execute(interaction, language);

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith({
        content: "session.invalid",
        flags: MessageFlags.Ephemeral,
      });
      expect(mockSendAndAwaitModalSubmit).not.toHaveBeenCalled();
    });

    it("should do nothing when modal is cancelled", async () => {
      // Arrange
      const interaction = {
        user: { id: "123" },
        reply: jest.fn(),
        targetMessage: { content: "Buy groceries" },
      } as any;
      const apiMock = {} as TodoistApi;
      (todoistClientMock.getUserApi as jest.Mock).mockResolvedValue(apiMock);
      mockSendAndAwaitModalSubmit.mockRejectedValue(new ModalCancelledError());

      // Act
      await command.execute(interaction, language);

      // Assert
      expect(interaction.reply).not.toHaveBeenCalled();
      expect(mockAddToTodoist).not.toHaveBeenCalled();
    });

    it("should delegate to handler with prefill when modal is submitted", async () => {
      // Arrange
      const interaction = {
        user: { id: "123" },
        reply: jest.fn(),
        targetMessage: { content: "Buy groceries" },
      } as any;
      const apiMock = {} as TodoistApi;
      (todoistClientMock.getUserApi as jest.Mock).mockResolvedValue(apiMock);

      const modalData: TaskAddModalData = {
        content: "Buy groceries",
        submission: { reply: jest.fn() } as any,
      };
      mockSendAndAwaitModalSubmit.mockResolvedValue(modalData);

      // Act
      await command.execute(interaction, language);

      // Assert
      expect(mockSendAndAwaitModalSubmit).toHaveBeenCalledWith(
        interaction,
        apiMock,
        language,
        { content: "Buy groceries", description: undefined },
      );
      expect(mockAddToTodoist).toHaveBeenCalledWith(
        "123",
        modalData,
        language,
        undefined,
        apiMock,
      );
    });

    it("should rethrow unexpected errors", async () => {
      // Arrange
      const interaction = {
        user: { id: "123" },
        reply: jest.fn(),
        targetMessage: { content: "A message" },
      } as any;
      const apiMock = {} as TodoistApi;
      (todoistClientMock.getUserApi as jest.Mock).mockResolvedValue(apiMock);
      mockSendAndAwaitModalSubmit.mockRejectedValue(
        new Error("Unexpected error"),
      );

      // Act & Assert
      await expect(command.execute(interaction, language))
        .rejects
        .toThrow("Unexpected error");
    });
  });

  describe("buildPrefill", () => {
    it("should use first line as content and remaining as description", async () => {
      // Arrange
      const interaction = {
        user: { id: "123" },
        reply: jest.fn(),
        targetMessage: { content: "First line\nSecond line\nThird line" },
      } as any;
      const apiMock = {} as TodoistApi;
      (todoistClientMock.getUserApi as jest.Mock).mockResolvedValue(apiMock);
      mockSendAndAwaitModalSubmit.mockResolvedValue({
        content: "First line",
        submission: { reply: jest.fn() },
      });

      // Act
      await command.execute(interaction, language);

      // Assert
      expect(mockSendAndAwaitModalSubmit).toHaveBeenCalledWith(
        interaction,
        apiMock,
        language,
        { content: "First line", description: "Second line\nThird line" },
      );
    });

    it("should trim leading whitespace from first line", async () => {
      // Arrange
      const interaction = {
        user: { id: "123" },
        reply: jest.fn(),
        targetMessage: { content: "   Indented line" },
      } as any;
      const apiMock = {} as TodoistApi;
      (todoistClientMock.getUserApi as jest.Mock).mockResolvedValue(apiMock);
      mockSendAndAwaitModalSubmit.mockResolvedValue({
        content: "x",
        submission: { reply: jest.fn() },
      });

      // Act
      await command.execute(interaction, language);

      // Assert
      expect(mockSendAndAwaitModalSubmit).toHaveBeenCalledWith(
        interaction,
        apiMock,
        language,
        { content: "Indented line", description: undefined },
      );
    });

    it("should truncate first line at 100 characters and move overflow to description", async () => {
      // Arrange
      const longLine = "A".repeat(120);
      const interaction = {
        user: { id: "123" },
        reply: jest.fn(),
        targetMessage: { content: longLine },
      } as any;
      const apiMock = {} as TodoistApi;
      (todoistClientMock.getUserApi as jest.Mock).mockResolvedValue(apiMock);
      mockSendAndAwaitModalSubmit.mockResolvedValue({
        content: "x",
        submission: { reply: jest.fn() },
      });

      // Act
      await command.execute(interaction, language);

      // Assert
      expect(mockSendAndAwaitModalSubmit).toHaveBeenCalledWith(
        interaction,
        apiMock,
        language,
        {
          content: "A".repeat(100) + "...",
          description: "..." + "A".repeat(20),
        },
      );
    });

    it("should combine overflow and remaining lines in description", async () => {
      // Arrange
      const longLine = "B".repeat(110);
      const interaction = {
        user: { id: "123" },
        reply: jest.fn(),
        targetMessage: { content: longLine + "\nExtra line" },
      } as any;
      const apiMock = {} as TodoistApi;
      (todoistClientMock.getUserApi as jest.Mock).mockResolvedValue(apiMock);
      mockSendAndAwaitModalSubmit.mockResolvedValue({
        content: "x",
        submission: { reply: jest.fn() },
      });

      // Act
      await command.execute(interaction, language);

      // Assert
      expect(mockSendAndAwaitModalSubmit).toHaveBeenCalledWith(
        interaction,
        apiMock,
        language,
        {
          content: "B".repeat(100) + "...",
          description: "..." + "B".repeat(10) + "\nExtra line",
        },
      );
    });

    it("should set description to undefined when message is single line under 100 chars", async () => {
      // Arrange
      const interaction = {
        user: { id: "123" },
        reply: jest.fn(),
        targetMessage: { content: "Short message" },
      } as any;
      const apiMock = {} as TodoistApi;
      (todoistClientMock.getUserApi as jest.Mock).mockResolvedValue(apiMock);
      mockSendAndAwaitModalSubmit.mockResolvedValue({
        content: "x",
        submission: { reply: jest.fn() },
      });

      // Act
      await command.execute(interaction, language);

      // Assert
      expect(mockSendAndAwaitModalSubmit).toHaveBeenCalledWith(
        interaction,
        apiMock,
        language,
        { content: "Short message", description: undefined },
      );
    });
  });
});
