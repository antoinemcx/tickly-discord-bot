import type { TaskAddModalData } from "@bot/commands/todoist/task-creation/TaskAddModal";
import type { TranslationHandler } from "@bot/handlers/TranslationHandler";
import type { Task, TodoistApi } from "@doist/todoist-api-typescript";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import { ModalCancelledError, TaskAddHandler } from "@bot/commands/todoist/task-creation/TaskAddHandler";
import { TaskAddModal } from "@bot/commands/todoist/task-creation/TaskAddModal";
import { Locale, MessageFlags } from "discord.js";

jest.mock("@bot/commands/todoist/task-creation/TaskAddModal");
jest.mock("@src/utils/logger", () => ({
  displayDetailedError: jest.fn(),
  generateErrorCode: jest.fn().mockReturnValue("ERR-456"),
}));

describe("TaskAddHandler", () => {
  const language = Locale.EnglishUS;
  let todoistClientMock: TodoistApiClient;
  let translationHandlerMock: TranslationHandler;
  let handler: TaskAddHandler;

  beforeEach(() => {
    jest.clearAllMocks();

    todoistClientMock = {
      addTaskBySelectedDate: jest.fn(),
    } as unknown as TodoistApiClient;

    translationHandlerMock = {
      translateCommon: jest.fn().mockImplementation(
        (_lang: Locale, key: string) => key,
      ),
    } as unknown as TranslationHandler;

    handler = new TaskAddHandler(
      todoistClientMock,
      translationHandlerMock,
      { 1: "p1", 2: "p2", 3: "p3", 4: "p4" },
    );
  });

  describe("sendAndAwaitModalSubmit", () => {
    it("should fetch projects, show modal and return submitted data", async () => {
      // Arrange
      const apiMock = {
        getProjects: jest.fn().mockResolvedValue({
          results: [
            { id: "1", name: "Inbox", isDeleted: false, isFrozen: false },
            { id: "2", name: "Deleted", isDeleted: true, isFrozen: false },
          ],
        }),
      } as unknown as TodoistApi;

      const modalData: TaskAddModalData = {
        content: "Test task",
        submission: { reply: jest.fn() } as any,
      };
      const mockBuild = jest.fn().mockReturnValue("built-modal");
      const mockAwaitSubmit = jest.fn().mockResolvedValue(modalData);
      (TaskAddModal as jest.MockedClass<typeof TaskAddModal>)
        .mockImplementation(
          () => ({ build: mockBuild, awaitSubmit: mockAwaitSubmit }) as any,
        );

      const interaction = {
        showModal: jest.fn(),
        awaitModalSubmit: jest.fn(),
      } as any;

      // Act
      const result = await handler.sendAndAwaitModalSubmit(
        interaction,
        apiMock,
        language,
      );

      // Assert
      expect(apiMock.getProjects).toHaveBeenCalled();
      expect(TaskAddModal).toHaveBeenCalledWith(
        [{ id: "1", name: "Inbox" }],
        translationHandlerMock,
        language,
        { 1: "p1", 2: "p2", 3: "p3", 4: "p4" },
        undefined,
      );
      expect(interaction.showModal).toHaveBeenCalledWith("built-modal");
      expect(result).toBe(modalData);
    });

    it("should filter out deleted and frozen projects", async () => {
      // Arrange
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

      const mockBuild = jest.fn().mockReturnValue("modal");
      const mockAwaitSubmit = jest.fn().mockResolvedValue({ content: "x" });
      (TaskAddModal as jest.MockedClass<typeof TaskAddModal>)
        .mockImplementation(
          () => ({ build: mockBuild, awaitSubmit: mockAwaitSubmit }) as any,
        );

      const interaction = { showModal: jest.fn() } as any;

      // Act
      await handler.sendAndAwaitModalSubmit(interaction, apiMock, language);

      // Assert
      expect(TaskAddModal).toHaveBeenCalledWith(
        [{ id: "1", name: "Active" }, { id: "4", name: "Also Active" }],
        expect.anything(),
        expect.anything(),
        expect.anything(),
        undefined,
      );
    });

    it("should pass prefill to the modal", async () => {
      // Arrange
      const apiMock = {
        getProjects: jest.fn().mockResolvedValue({
          results: [
            { id: "1", name: "Inbox", isDeleted: false, isFrozen: false },
          ],
        }),
      } as unknown as TodoistApi;

      const mockBuild = jest.fn().mockReturnValue("modal");
      const mockAwaitSubmit = jest.fn().mockResolvedValue({ content: "x" });
      (TaskAddModal as jest.MockedClass<typeof TaskAddModal>)
        .mockImplementation(
          () => ({ build: mockBuild, awaitSubmit: mockAwaitSubmit }) as any,
        );

      const interaction = { showModal: jest.fn() } as any;
      const prefill = { content: "Prefilled content" };

      // Act
      await handler.sendAndAwaitModalSubmit(
        interaction,
        apiMock,
        language,
        prefill,
      );

      // Assert
      expect(TaskAddModal).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        prefill,
      );
    });

    it("should reply with error and throw ModalCancelledError when fetching projects fails", async () => {
      // Arrange
      const apiMock = {
        getProjects: jest.fn().mockRejectedValue(new Error("API error")),
      } as unknown as TodoistApi;

      const interaction = { showModal: jest.fn(), reply: jest.fn() } as any;

      // Act & Assert
      await expect(
        handler.sendAndAwaitModalSubmit(interaction, apiMock, language),
      ).rejects.toThrow(ModalCancelledError);
      expect(interaction.reply).toHaveBeenCalledWith({
        content: "add-task.projects-fetch-error",
        flags: MessageFlags.Ephemeral,
      });
      expect(interaction.showModal).not.toHaveBeenCalled();
    });

    it("should throw ModalCancelledError when modal times out", async () => {
      // Arrange
      const apiMock = {
        getProjects: jest.fn().mockResolvedValue({
          results: [
            { id: "1", name: "Inbox", isDeleted: false, isFrozen: false },
          ],
        }),
      } as unknown as TodoistApi;

      const mockBuild = jest.fn().mockReturnValue("modal");
      const mockAwaitSubmit = jest.fn().mockRejectedValue(new Error("timeout"));
      (TaskAddModal as jest.MockedClass<typeof TaskAddModal>)
        .mockImplementation(
          () => ({ build: mockBuild, awaitSubmit: mockAwaitSubmit }) as any,
        );

      const interaction = { showModal: jest.fn() } as any;

      // Act & Assert
      await expect(
        handler.sendAndAwaitModalSubmit(interaction, apiMock, language),
      ).rejects.toThrow(ModalCancelledError);
    });
  });

  describe("addToTodoist", () => {
    it("should create a task and reply with success", async () => {
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
      await handler.addToTodoist("user-123", modalData, language);

      // Assert
      expect(todoistClientMock.addTaskBySelectedDate).toHaveBeenCalledWith(
        "user-123",
        undefined,
        {
          content: "Buy groceries",
          description: "Milk and eggs",
          priority: 3,
          projectId: "proj-1",
        },
        undefined,
      );
      expect(submission.reply).toHaveBeenCalledWith({
        content: "add-task.success",
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should pass api instance to addTaskBySelectedDate", async () => {
      // Arrange
      const submission = { reply: jest.fn() } as any;
      const modalData: TaskAddModalData = {
        content: "A task",
        submission,
      };
      const apiMock = {} as TodoistApi;
      const createdTask: Partial<Task> = {
        content: "A task",
        url: "https://todoist.com/task/1",
        projectId: "proj-1",
        due: null as any,
      };
      todoistClientMock.addTaskBySelectedDate
        = jest.fn().mockResolvedValue(createdTask);

      // Act
      await handler.addToTodoist("user-123", modalData, language, undefined, apiMock);

      // Assert
      expect(todoistClientMock.addTaskBySelectedDate).toHaveBeenCalledWith(
        "user-123",
        undefined,
        expect.anything(),
        apiMock,
      );
    });

    it("should not set projectId when project is none value", async () => {
      // Arrange
      const submission = { reply: jest.fn() } as any;
      const modalData: TaskAddModalData = {
        content: "A task",
        project: TaskAddModal.PROJECT_NONE_VALUE,
        submission,
      };
      const createdTask: Partial<Task> = {
        content: "A task",
        url: "https://todoist.com/task/1",
        projectId: "default",
        due: null as any,
      };
      todoistClientMock.addTaskBySelectedDate
        = jest.fn().mockResolvedValue(createdTask);

      // Act
      await handler.addToTodoist("user-123", modalData, language);

      // Assert
      expect(todoistClientMock.addTaskBySelectedDate).toHaveBeenCalledWith(
        "user-123",
        undefined,
        expect.objectContaining({ projectId: undefined }),
        undefined,
      );
    });

    it("should reply with error when task creation fails", async () => {
      // Arrange
      const submission = { reply: jest.fn() } as any;
      const modalData: TaskAddModalData = {
        content: "A task",
        submission,
      };
      todoistClientMock.addTaskBySelectedDate
        = jest.fn().mockRejectedValue(new Error("API failure"));

      // Act
      await handler.addToTodoist("user-123", modalData, language);

      // Assert
      expect(submission.reply).toHaveBeenCalledWith({
        content: "add-task.creation-error",
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should truncate task content longer than 80 characters in success message", async () => {
      // Arrange
      const submission = { reply: jest.fn() } as any;
      const longContent = "A".repeat(100);
      const modalData: TaskAddModalData = {
        content: longContent,
        submission,
      };
      const createdTask: Partial<Task> = {
        content: longContent,
        url: "https://todoist.com/task/1",
        projectId: "proj-1",
        due: null as any,
      };
      todoistClientMock.addTaskBySelectedDate
        = jest.fn().mockResolvedValue(createdTask);

      (translationHandlerMock.translateCommon as jest.Mock).mockImplementation(
        (_lang: Locale, key: string, params?: Record<string, string>) => {
          if (key === "add-task.success" && params?.task) {
            return params.task;
          }
          return key;
        },
      );

      // Act
      await handler.addToTodoist("user-123", modalData, language);

      // Assert
      const replyContent = submission.reply.mock.calls[0][0].content;
      expect(replyContent.length).toBeLessThanOrEqual(83); // 80 + "..."
      expect(replyContent.endsWith("...")).toBe(true);
    });

    it("should use success-no-date translation when task has no due date", async () => {
      // Arrange
      const submission = { reply: jest.fn() } as any;
      const modalData: TaskAddModalData = {
        content: "A task",
        submission,
      };
      const createdTask: Partial<Task> = {
        content: "A task",
        url: "https://todoist.com/task/1",
        projectId: "proj-1",
        due: null as any,
      };
      todoistClientMock.addTaskBySelectedDate
        = jest.fn().mockResolvedValue(createdTask);

      // Act
      await handler.addToTodoist("user-123", modalData, language);

      // Assert
      expect(translationHandlerMock.translateCommon).toHaveBeenCalledWith(
        language,
        "add-task.success-no-date",
      );
    });

    it("should call quickAddTask and reply with success when data is a string", async () => {
      // Arrange
      const interaction = { reply: jest.fn() } as any;
      const createdTask: Partial<Task> = {
        content: "Buy milk tomorrow",
        url: "https://todoist.com/task/456",
        projectId: "proj-1",
        due: {
          date: "2026-06-01",
          string: "Jun 1",
          isRecurring: false,
          timezone: null,
          datetime: null,
        },
      };
      todoistClientMock.quickAddTask
        = jest.fn().mockResolvedValue(createdTask);

      // Act
      await handler.addToTodoist("user-123", "Buy milk tomorrow", language, interaction);

      // Assert
      expect(todoistClientMock.quickAddTask).toHaveBeenCalledWith(
        "user-123",
        { text: "Buy milk tomorrow" },
        undefined,
      );
      expect(interaction.reply).toHaveBeenCalledWith({
        content: "add-task.success",
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should pass api instance to quickAddTask when data is a string", async () => {
      // Arrange
      const interaction = { reply: jest.fn() } as any;
      const apiMock = {} as TodoistApi;
      const createdTask: Partial<Task> = {
        content: "A quick task",
        url: "https://todoist.com/task/789",
        projectId: "proj-1",
        due: null as any,
      };
      todoistClientMock.quickAddTask
        = jest.fn().mockResolvedValue(createdTask);

      // Act
      await handler.addToTodoist("user-123", "A quick task", language, interaction, apiMock);

      // Assert
      expect(todoistClientMock.quickAddTask).toHaveBeenCalledWith(
        "user-123",
        { text: "A quick task" },
        apiMock,
      );
    });

    it("should reply with error when quickAddTask fails", async () => {
      // Arrange
      const interaction = { reply: jest.fn() } as any;
      todoistClientMock.quickAddTask
        = jest.fn().mockRejectedValue(new Error("API failure"));

      // Act
      await handler.addToTodoist("user-123", "Failing task", language, interaction);

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith({
        content: "add-task.creation-error",
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should load projects and resolve project name when api is provided", async () => {
      // Arrange
      const submission = { reply: jest.fn() } as any;
      const modalData: TaskAddModalData = {
        content: "A task",
        project: "proj-1",
        submission,
      };
      const apiMock = {
        getProjects: jest.fn().mockResolvedValue({
          results: [
            { id: "proj-1", name: "Work", isDeleted: false, isFrozen: false },
          ],
        }),
      } as unknown as TodoistApi;
      const createdTask: Partial<Task> = {
        content: "A task",
        url: "https://todoist.com/task/1",
        projectId: "proj-1",
        due: null as any,
      };
      todoistClientMock.addTaskBySelectedDate
        = jest.fn().mockResolvedValue(createdTask);

      (translationHandlerMock.translateCommon as jest.Mock).mockImplementation(
        (_lang: Locale, key: string, params?: Record<string, string>) => {
          if (key === "add-task.success" && params?.project) {
            return params.project;
          }
          return key;
        },
      );

      // Act
      await handler.addToTodoist("user-123", modalData, language, undefined, apiMock);

      // Assert
      expect(apiMock.getProjects).toHaveBeenCalled();
      const replyContent = submission.reply.mock.calls[0][0].content;
      expect(replyContent).toBe("Work");
    });

    it("should silently ignore project fetch failure in addToTodoist", async () => {
      // Arrange
      const submission = { reply: jest.fn() } as any;
      const modalData: TaskAddModalData = {
        content: "A task",
        project: "proj-1",
        submission,
      };
      const apiMock = {
        getProjects: jest.fn().mockRejectedValue(new Error("Network error")),
      } as unknown as TodoistApi;
      const createdTask: Partial<Task> = {
        content: "A task",
        url: "https://todoist.com/task/1",
        projectId: "proj-1",
        due: null as any,
      };
      todoistClientMock.addTaskBySelectedDate
        = jest.fn().mockResolvedValue(createdTask);

      // Act
      await handler.addToTodoist("user-123", modalData, language, undefined, apiMock);

      // Assert
      expect(submission.reply).toHaveBeenCalledWith({
        content: "add-task.success",
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should not fetch projects again if already loaded", async () => {
      // Arrange
      const apiMock = {
        getProjects: jest.fn().mockResolvedValue({
          results: [
            { id: "proj-1", name: "Work", isDeleted: false, isFrozen: false },
          ],
        }),
      } as unknown as TodoistApi;

      const mockBuild = jest.fn().mockReturnValue("modal");
      const mockAwaitSubmit = jest.fn().mockResolvedValue({
        content: "A task",
        project: "proj-1",
        submission: { reply: jest.fn() },
      });
      (TaskAddModal as jest.MockedClass<typeof TaskAddModal>)
        .mockImplementation(
          () => ({ build: mockBuild, awaitSubmit: mockAwaitSubmit }) as any,
        );

      const interaction = { showModal: jest.fn() } as any;
      await handler.sendAndAwaitModalSubmit(interaction, apiMock, language);

      const submission = { reply: jest.fn() } as any;
      const modalData: TaskAddModalData = {
        content: "A task",
        project: "proj-1",
        submission,
      };
      const createdTask: Partial<Task> = {
        content: "A task",
        url: "https://todoist.com/task/1",
        projectId: "proj-1",
        due: null as any,
      };
      todoistClientMock.addTaskBySelectedDate
        = jest.fn().mockResolvedValue(createdTask);

      // Act
      await handler.addToTodoist("user-123", modalData, language, undefined, apiMock);

      // Assert – getProjects called only once (during sendAndAwaitModalSubmit)
      expect(apiMock.getProjects).toHaveBeenCalledTimes(1);
    });
  });
});
