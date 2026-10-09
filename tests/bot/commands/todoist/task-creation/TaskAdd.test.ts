import type { TaskAddModalData } from "@bot/commands/todoist/task-creation/TaskAddModal";
import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApi } from "@doist/todoist-api-typescript";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import TaskAdd from "@bot/commands/todoist/task-creation/TaskAdd";
import { ModalCancelledError, TaskAddHandler } from "@bot/commands/todoist/task-creation/TaskAddHandler";
import { Locale, MessageFlags } from "discord.js";

jest.mock("@bot/commands/todoist/task-creation/TaskAddHandler");
jest.mock("@src/utils/logger", () => ({
  displayDetailedError: jest.fn(),
  generateErrorCode: jest.fn().mockReturnValue("ERR-123"),
}));

describe("TaskAdd Command", () => {
  const language = Locale.EnglishUS;
  let command: TaskAdd;
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

    command = new TaskAdd(
      clientMock,
      todoistClientMock,
      {} as RepositoryFactory,
      "todoist",
    );
  });

  describe("constructor", () => {
    it("should register the actions component handler", () => {
      // Act
      const handlers = command.getMessageComponentHandlers();

      // Assert
      expect(handlers.has(`todoist:add:${TaskAddHandler.ACTIONS_COMPONENT_ID}`)).toBe(true);
    });

    it("should delegate to TaskAddHandler.handleTaskAction for select menu interactions", async () => {
      // Arrange
      const handlers = command.getMessageComponentHandlers();
      const componentId = `todoist:add:${TaskAddHandler.ACTIONS_COMPONENT_ID}`;
      const handler = handlers.get(componentId)!;
      const interaction = {
        isStringSelectMenu: () => true,
        values: ["complete:task-123:Buy milk"],
        user: { id: "user-123" },
      } as any;
      (TaskAddHandler.handleTaskAction as jest.Mock).mockResolvedValue(undefined);

      // Act
      await handler(interaction, language);

      // Assert
      expect(TaskAddHandler.handleTaskAction).toHaveBeenCalledWith(
        interaction,
        language,
        todoistClientMock,
        clientMock,
      );
    });

    it("should not call handleTaskAction for non-select-menu interactions", async () => {
      // Arrange
      const handlers = command.getMessageComponentHandlers();
      const componentId = `todoist:add:${TaskAddHandler.ACTIONS_COMPONENT_ID}`;
      const handler = handlers.get(componentId)!;
      const interaction = {
        isStringSelectMenu: () => false,
      } as any;

      // Act
      await handler(interaction, language);

      // Assert
      expect(TaskAddHandler.handleTaskAction).not.toHaveBeenCalled();
    });
  });

  it("should have the correct name", () => {
    // Act
    const result = command.getName();
    // Assert
    expect(result).toBe("add");
  });

  describe("execute", () => {
    it("should reply with session error when getUserApi throws", async () => {
      // Arrange
      const interaction = {
        user: { id: "123" },
        options: { getString: jest.fn().mockReturnValue(null) },
        reply: jest.fn(),
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

    it("should do nothing when fetching projects fails (handler replies internally)", async () => {
      // Arrange
      const interaction = {
        user: { id: "123" },
        options: { getString: jest.fn().mockReturnValue(null) },
        reply: jest.fn(),
      } as any;
      const apiMock = {} as TodoistApi;
      (todoistClientMock.getUserApi as jest.Mock).mockResolvedValue(apiMock);
      mockSendAndAwaitModalSubmit.mockRejectedValue(
        new ModalCancelledError(),
      );

      // Act
      await command.execute(interaction, language);

      // Assert
      expect(interaction.reply).not.toHaveBeenCalled();
      expect(mockAddToTodoist).not.toHaveBeenCalled();
    });

    it("should do nothing when the modal is cancelled", async () => {
      // Arrange
      const interaction = {
        user: { id: "123" },
        options: { getString: jest.fn().mockReturnValue(null) },
        reply: jest.fn(),
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

    it("should delegate to handler when modal is submitted", async () => {
      // Arrange
      const interaction = {
        user: { id: "123" },
        options: { getString: jest.fn().mockReturnValue(null) },
        reply: jest.fn(),
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
      );
      expect(mockAddToTodoist).toHaveBeenCalledWith(
        "123",
        modalData,
        language,
        expect.any(Function),
        undefined,
        apiMock,
      );
    });

    it("should call quickAdd via addToTodoist when content option is provided", async () => {
      // Arrange
      const interaction = {
        user: { id: "123" },
        options: { getString: jest.fn().mockReturnValue("Buy milk tomorrow") },
        reply: jest.fn(),
      } as any;
      const apiMock = {} as TodoistApi;
      (todoistClientMock.getUserApi as jest.Mock).mockResolvedValue(apiMock);

      // Act
      await command.execute(interaction, language);

      // Assert
      expect(mockSendAndAwaitModalSubmit).not.toHaveBeenCalled();
      expect(mockAddToTodoist).toHaveBeenCalledWith(
        "123",
        "Buy milk tomorrow",
        language,
        expect.any(Function),
        interaction,
        apiMock,
      );
    });

    it("should rethrow unexpected errors", async () => {
      // Arrange
      const interaction = {
        user: { id: "123" },
        options: { getString: jest.fn().mockReturnValue(null) },
        reply: jest.fn(),
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
});
