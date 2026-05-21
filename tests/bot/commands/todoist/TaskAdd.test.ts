import type { TaskAddModalData } from "@bot/commands/todoist/TaskAddModal";
import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { Task, TodoistApi } from "@doist/todoist-api-typescript";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import TaskAdd from "@bot/commands/todoist/TaskAdd";
import { TaskAddModal } from "@bot/commands/todoist/TaskAddModal";
import { Locale, MessageFlags } from "discord.js";

jest.mock("@bot/commands/todoist/TaskAddModal");
jest.mock("@src/utils/logger", () => ({
  displayDetailedError: jest.fn(),
  generateErrorCode: jest.fn().mockReturnValue("ERR-123"),
}));

describe("TaskAdd Command", () => {
  const language = Locale.EnglishUS;
  let command: TaskAdd;
  let clientMock: Tickly;
  let todoistClientMock: TodoistApiClient;

  beforeEach(() => {
    jest.clearAllMocks();

    clientMock = {
      getTranslationHandler: jest.fn().mockReturnValue({
        translateCommand: (_lang: Locale, _cmd: string, key: string) => key,
        translateCommon: (_lang: Locale, key: string) => key,
      }),
      getCommandMention: jest.fn().mockResolvedValue("/todoist login"),
      getConfig: jest.fn().mockReturnValue({ emotes: {
        priorities: {
          1: "p1_emote",
          2: "p2_emote",
          3: "p3_emote",
          4: "p4_emote",
        },
      } }),

    } as unknown as Tickly;

    todoistClientMock = {} as TodoistApiClient;

    command = new TaskAdd(
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
    expect(result).toBe("add");
  });

  describe("execute", () => {
    it("should reply with session error when getUserApi throws", async () => {
      // Arrange
      const interaction = {
        user: { id: "123" },
        reply: jest.fn(),
        showModal: jest.fn(),
      } as any;
      todoistClientMock.getUserApi
        = jest.fn().mockRejectedValue(new Error("No token"));

      // Act
      await command.execute(interaction, language);

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith({
        content: "session.invalid",
        flags: MessageFlags.Ephemeral,
      });
      expect(interaction.showModal).not.toHaveBeenCalled();
    });

    it("should reply with error when fetching projects fails", async () => {
      // Arrange
      const interaction = {
        user: { id: "123" },
        reply: jest.fn(),
        showModal: jest.fn(),
      } as any;
      const apiMock = {
        getProjects: jest.fn().mockRejectedValue(new Error("API error")),
      } as unknown as TodoistApi;
      todoistClientMock.getUserApi = jest.fn().mockResolvedValue(apiMock);

      // Act
      await command.execute(interaction, language);

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith({
        content: "todoist.projects-fetch-error",
        flags: MessageFlags.Ephemeral,
      });
      expect(interaction.showModal).not.toHaveBeenCalled();
    });

    it("should filter out deleted and frozen projects", async () => {
      // Arrange
      const interaction = {
        user: { id: "123" },
        reply: jest.fn(),
        showModal: jest.fn(),
        awaitModalSubmit: jest.fn().mockRejectedValue(new Error("timeout")),
      } as any;
      const apiMock = {
        getProjects: jest.fn().mockResolvedValue({
          results: [
            { id: "1", name: "Active", isDeleted: false, isFrozen: false },
            { id: "2", name: "Deleted", isDeleted: true, isFrozen: false },
            { id: "3", name: "Frozen", isDeleted: false, isFrozen: true },
            { id: "4", name: "Also Active", isDeleted: false, isFrozen: false },
          ],
        }),
      } as unknown as TodoistApi;
      todoistClientMock.getUserApi = jest.fn().mockResolvedValue(apiMock);

      const mockBuild = jest.fn().mockReturnValue("modal");
      const mockAwaitSubmit
        = jest.fn().mockRejectedValue(new Error("timeout"));
      (TaskAddModal as jest.MockedClass<typeof TaskAddModal>)
        .mockImplementation(
          () => ({ build: mockBuild, awaitSubmit: mockAwaitSubmit }) as any,
        );

      // Act
      await command.execute(interaction, language);

      // Assert
      expect(TaskAddModal).toHaveBeenCalledWith(
        [
          { id: "1", name: "Active" },
          { id: "4", name: "Also Active" },
        ],
        expect.anything(),
        language,
        expect.anything(),
      );
    });

    it("should show a modal when api and projects are available", async () => {
      // Arrange
      const interaction = {
        user: { id: "123" },
        reply: jest.fn(),
        showModal: jest.fn(),
      } as any;
      const apiMock = {
        getProjects: jest.fn().mockResolvedValue({
          results: [
            { id: "1", name: "Inbox", isDeleted: false, isFrozen: false },
          ],
        }),
      } as unknown as TodoistApi;
      todoistClientMock.getUserApi = jest.fn().mockResolvedValue(apiMock);

      const mockBuild = jest.fn().mockReturnValue("modal-data");
      const mockAwaitSubmit = jest.fn().mockRejectedValue(new Error("timeout"));
      (TaskAddModal as jest.MockedClass<typeof TaskAddModal>)
        .mockImplementation(
          () => ({ build: mockBuild, awaitSubmit: mockAwaitSubmit }) as any,
        );

      // Act
      await command.execute(interaction, language);

      // Assert
      expect(interaction.showModal).toHaveBeenCalledWith("modal-data");
    });

    it("should do nothing when the modal times out", async () => {
      // Arrange
      const interaction = {
        user: { id: "123" },
        reply: jest.fn(),
        showModal: jest.fn(),
      } as any;
      const apiMock = {
        getProjects: jest.fn().mockResolvedValue({
          results: [
            { id: "1", name: "Inbox", isDeleted: false, isFrozen: false },
          ],
        }),
      } as unknown as TodoistApi;
      todoistClientMock.getUserApi = jest.fn().mockResolvedValue(apiMock);

      const mockAwaitSubmit = jest.fn().mockRejectedValue(new Error("timeout"));
      (TaskAddModal as jest.MockedClass<typeof TaskAddModal>)
        .mockImplementation(
          () => ({ build: jest.fn(), awaitSubmit: mockAwaitSubmit }) as any,
        );
      todoistClientMock.addTaskBySelectedDate = jest.fn();

      // Act
      await command.execute(interaction, language);

      // Assert
      expect(todoistClientMock.addTaskBySelectedDate).not.toHaveBeenCalled();
    });

    it("should add a task to Todoist when the modal is submitted", async () => {
      // Arrange
      const submission = { reply: jest.fn() } as any;
      const modalData: TaskAddModalData = {
        content: "Buy groceries",
        description: "Milk and eggs",
        project: "proj-1",
        priority: 3,
        dueDateString: undefined,
        submission,
      };
      const interaction = {
        user: { id: "123" },
        reply: jest.fn(),
        showModal: jest.fn(),
      } as any;
      const apiMock = {
        getProjects: jest.fn().mockResolvedValue({
          results: [
            { id: "proj-1", name: "Shopping", isDeleted: false, isFrozen: false },
          ],
        }),
      } as unknown as TodoistApi;
      todoistClientMock.getUserApi = jest.fn().mockResolvedValue(apiMock);

      const mockAwaitSubmit = jest.fn().mockResolvedValue(modalData);
      (TaskAddModal as jest.MockedClass<typeof TaskAddModal>)
        .mockImplementation(
          () => ({ build: jest.fn(), awaitSubmit: mockAwaitSubmit }) as any,
        );

      const createdTask: Partial<Task> = {
        content: "Buy groceries",
        url: "https://todoist.com/task/123",
        projectId: "proj-1",
        due: {
          date: "2026-05-21",
          string: "May 21",
          isRecurring: false,
          timezone: null,
          datetime: null,
        },
      };
      todoistClientMock.addTaskBySelectedDate
        = jest.fn().mockResolvedValue(createdTask);

      // Act
      await command.execute(interaction, language);

      // Assert
      expect(todoistClientMock.addTaskBySelectedDate).toHaveBeenCalledWith(
        "123",
        undefined,
        {
          content: "Buy groceries",
          description: "Milk and eggs",
          priority: 3,
          projectId: "proj-1",
        },
        apiMock,
      );
      expect(submission.reply).toHaveBeenCalledWith({
        content: expect.stringContaining("success"),
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should reply with error when task addition fails", async () => {
      // Arrange
      const submission = { reply: jest.fn() } as any;
      const modalData: TaskAddModalData = {
        content: "Some task",
        submission,
      };
      const interaction = {
        user: { id: "123" },
        reply: jest.fn(),
        showModal: jest.fn(),
      } as any;
      const apiMock = {
        getProjects: jest.fn().mockResolvedValue({
          results: [{ id: "1", name: "Inbox", isDeleted: false, isFrozen: false }],
        }),
      } as unknown as TodoistApi;
      todoistClientMock.getUserApi = jest.fn().mockResolvedValue(apiMock);

      const mockAwaitSubmit = jest.fn().mockResolvedValue(modalData);
      (TaskAddModal as jest.MockedClass<typeof TaskAddModal>)
        .mockImplementation(
          () => ({ build: jest.fn(), awaitSubmit: mockAwaitSubmit }) as any,
        );
      todoistClientMock.addTaskBySelectedDate = jest.fn().mockRejectedValue(
        new Error("API failure"),
      );

      // Act
      await command.execute(interaction, language);

      // Assert
      expect(submission.reply).toHaveBeenCalledWith({
        content: expect.stringContaining("creation-error"),
        flags: MessageFlags.Ephemeral,
      });
    });
  });
});
