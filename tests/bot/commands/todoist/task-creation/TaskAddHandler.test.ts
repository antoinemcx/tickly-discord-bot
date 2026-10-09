import type { TaskAddModalData } from "@bot/commands/todoist/task-creation/TaskAddModal";
import type { TranslationHandler } from "@bot/handlers/TranslationHandler";
import type { Tickly } from "@bot/Tickly";
import type { Task, TodoistApi } from "@doist/todoist-api-typescript";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import { ModalCancelledError, TaskAddHandler } from "@bot/commands/todoist/task-creation/TaskAddHandler";
import { TaskAddModal } from "@bot/commands/todoist/task-creation/TaskAddModal";
import { OAuthError } from "@services/todoist/errors/OAuthError";
import { Locale, MessageFlags } from "discord.js";

jest.mock("@bot/commands/todoist/task-creation/TaskAddModal");
jest.mock("@src/utils/logger", () => ({
  displayDetailedError: jest.fn(),
  generateErrorCode: jest.fn().mockReturnValue("ERR-456"),
}));

describe("TaskAddHandler", () => {
  const language = Locale.EnglishUS;
  const mockComponentIdBuilder = (action: string) => `test:command:${action}`;
  let todoistClientMock: TodoistApiClient;
  let clientMock: Tickly;
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

    clientMock = {
      getTranslationHandler: jest.fn().mockReturnValue(translationHandlerMock),
      getConfig: jest.fn().mockReturnValue({
        emotes: { priorities: { 1: "p1", 2: "p2", 3: "p3", 4: "p4" } },
      }),
      getCommandMention: jest.fn().mockResolvedValue("/todoist login"),
    } as unknown as Tickly;

    handler = new TaskAddHandler(todoistClientMock, clientMock);
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
        "add",
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
        "add",
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
        "add",
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
      await handler.addToTodoist("user-123", modalData, language, mockComponentIdBuilder);

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
      expect(submission.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.any(String),
          components: expect.any(Array),
          flags: MessageFlags.Ephemeral,
        }),
      );
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
      await handler.addToTodoist("user-123", modalData, language, mockComponentIdBuilder, undefined, apiMock);

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
      await handler.addToTodoist("user-123", modalData, language, mockComponentIdBuilder);

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
      await handler.addToTodoist("user-123", modalData, language, mockComponentIdBuilder);

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

      let capturedTaskParam: string | undefined;
      (translationHandlerMock.translateCommon as jest.Mock).mockImplementation(
        (_lang: Locale, key: string, params?: Record<string, string>) => {
          if (key === "add-task.success" && params?.task) {
            capturedTaskParam = params.task;
            return params.task;
          }
          return key;
        },
      );

      // Act
      await handler.addToTodoist("user-123", modalData, language, mockComponentIdBuilder);

      // Assert - verify the task param passed to translateCommon is truncated
      expect(capturedTaskParam).toBeDefined();
      expect(capturedTaskParam!.length).toBeLessThanOrEqual(83); // 80 + "..."
      expect(capturedTaskParam!.endsWith("...")).toBe(true);
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
      await handler.addToTodoist("user-123", modalData, language, mockComponentIdBuilder);

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
      await handler.addToTodoist("user-123", "Buy milk tomorrow", language, mockComponentIdBuilder, interaction);

      // Assert
      expect(todoistClientMock.quickAddTask).toHaveBeenCalledWith(
        "user-123",
        { text: "Buy milk tomorrow" },
        undefined,
      );
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.any(String),
          components: expect.any(Array),
          flags: MessageFlags.Ephemeral,
        }),
      );
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
      await handler.addToTodoist("user-123", "A quick task", language, mockComponentIdBuilder, interaction, apiMock);

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
      await handler.addToTodoist("user-123", "Failing task", language, mockComponentIdBuilder, interaction);

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
      await handler.addToTodoist("user-123", modalData, language, mockComponentIdBuilder, undefined, apiMock);

      // Assert
      expect(apiMock.getProjects).toHaveBeenCalled();
      expect(translationHandlerMock.translateCommon).toHaveBeenCalledWith(
        language,
        "add-task.success",
        expect.objectContaining({ project: "Work" }),
      );
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
      await handler.addToTodoist("user-123", modalData, language, mockComponentIdBuilder, undefined, apiMock);

      // Assert
      expect(submission.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.any(String),
          components: expect.any(Array),
          flags: MessageFlags.Ephemeral,
        }),
      );
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
      await handler.addToTodoist("user-123", modalData, language, mockComponentIdBuilder, undefined, apiMock);

      // Assert – getProjects called only once (during sendAndAwaitModalSubmit)
      expect(apiMock.getProjects).toHaveBeenCalledTimes(1);
    });
  });

  describe("handleTaskAction", () => {
    let todoistClientMock: TodoistApiClient;
    let clientMock: Tickly;
    let actionHandler: TaskAddHandler;
    const mockComponentIdBuilder = (action: string) => `test:command:${action}`;

    /** Helper to create a mock interaction with all required fields */
    const createMockInteraction = (overrides: Record<string, unknown> = {}) => ({
      values: ["complete:task-123:Test"],
      user: { id: "user-123" },
      reply: jest.fn(),
      deferReply: jest.fn(),
      editReply: jest.fn(),
      showModal: jest.fn(),
      awaitModalSubmit: jest.fn(),
      ...overrides,
    });

    beforeEach(() => {
      todoistClientMock = {
        closeTask: jest.fn().mockResolvedValue(undefined),
        deleteTask: jest.fn().mockResolvedValue(undefined),
        getUserApi: jest.fn().mockResolvedValue({
          getProjects: jest.fn().mockResolvedValue({ results: [] }),
        }),
        getTask: jest.fn().mockResolvedValue({
          id: "task-123",
          content: "Test task",
          description: "Test description",
          priority: 2,
          due: { date: "2026-06-01", string: "Jun 1", isRecurring: false },
          projectId: "proj-1",
          url: "https://todoist.com/task/123",
        }),
        addTaskBySelectedDate: jest.fn().mockResolvedValue({
          id: "subtask-456",
          content: "New subtask",
          url: "https://todoist.com/task/456",
          projectId: "proj-1",
        }),
        updateTask: jest.fn().mockResolvedValue({
          id: "task-123",
          content: "Updated task",
          url: "https://todoist.com/task/123",
          projectId: "proj-1",
        }),
      } as unknown as TodoistApiClient;

      clientMock = {
        getTranslationHandler: jest.fn().mockReturnValue({
          translateCommon: jest.fn().mockImplementation(
            (_lang: Locale, key: string) => key,
          ),
        }),
        getCommandMention: jest.fn().mockResolvedValue("/todoist login"),
        getConfig: jest.fn().mockReturnValue({
          emotes: { priorities: { 1: "p1", 2: "p2", 3: "p3", 4: "p4" } },
        }),
      } as unknown as Tickly;

      actionHandler = new TaskAddHandler(todoistClientMock, clientMock);
    });

    it("should reply with error when action value is invalid", async () => {
      // Arrange
      const interaction = createMockInteraction({ values: ["invalid"] });

      // Act
      await actionHandler.handleTaskAction(
        interaction,
        Locale.EnglishUS,
        mockComponentIdBuilder,
      );

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith({
        content: "interactionHandling.executionError",
        flags: MessageFlags.Ephemeral,
      });
      expect(interaction.deferReply).not.toHaveBeenCalled();
    });

    it("should complete task successfully", async () => {
      // Arrange
      const interaction = createMockInteraction({
        values: ["complete:task-123:Buy milk"],
      });

      // Act
      await actionHandler.handleTaskAction(
        interaction,
        Locale.EnglishUS,
        mockComponentIdBuilder,
      );

      // Assert
      expect(interaction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
      expect(todoistClientMock.closeTask).toHaveBeenCalledWith("user-123", "task-123");
      expect(interaction.editReply).toHaveBeenCalledWith({
        content: "add-task.actions.complete.success",
      });
    });

    it("should delete task successfully", async () => {
      // Arrange
      const interaction = createMockInteraction({
        values: ["delete:task-456:Important task"],
      });

      // Act
      await actionHandler.handleTaskAction(
        interaction,
        Locale.EnglishUS,
        mockComponentIdBuilder,
      );

      // Assert
      expect(interaction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
      expect(todoistClientMock.deleteTask).toHaveBeenCalledWith("user-123", "task-456");
      expect(interaction.editReply).toHaveBeenCalledWith({
        content: "add-task.actions.delete.success",
      });
    });

    it("should show session error when OAuthError is thrown on complete", async () => {
      // Arrange
      const interaction = createMockInteraction({
        values: ["complete:task-123:Buy milk"],
      });
      (todoistClientMock.closeTask as jest.Mock)
        .mockRejectedValue(new OAuthError("Session expired"));

      // Act
      await actionHandler.handleTaskAction(
        interaction,
        Locale.EnglishUS,
        mockComponentIdBuilder,
      );

      // Assert
      expect(clientMock.getCommandMention).toHaveBeenCalledWith("todoist login");
      expect(interaction.editReply).toHaveBeenCalledWith({
        content: "session.invalid",
      });
    });

    it("should show session error when OAuthError is thrown on delete", async () => {
      // Arrange
      const interaction = createMockInteraction({
        values: ["delete:task-456:Task"],
      });
      (todoistClientMock.deleteTask as jest.Mock)
        .mockRejectedValue(new OAuthError("Session expired"));

      // Act
      await actionHandler.handleTaskAction(
        interaction,
        Locale.EnglishUS,
        mockComponentIdBuilder,
      );

      // Assert
      expect(clientMock.getCommandMention).toHaveBeenCalledWith("todoist login");
      expect(interaction.editReply).toHaveBeenCalledWith({
        content: "session.invalid",
      });
    });

    it("should show complete error with error code on API failure", async () => {
      // Arrange
      const interaction = createMockInteraction({
        values: ["complete:task-123:Buy milk"],
      });
      (todoistClientMock.closeTask as jest.Mock)
        .mockRejectedValue(new Error("API error"));

      // Act
      await actionHandler.handleTaskAction(
        interaction,
        Locale.EnglishUS,
        mockComponentIdBuilder,
      );

      // Assert
      expect(interaction.editReply).toHaveBeenCalledWith({
        content: "add-task.actions.complete.error",
      });
    });

    it("should show delete error with error code on API failure", async () => {
      // Arrange
      const interaction = createMockInteraction({
        values: ["delete:task-456:Task"],
      });
      (todoistClientMock.deleteTask as jest.Mock)
        .mockRejectedValue(new Error("API error"));

      // Act
      await actionHandler.handleTaskAction(
        interaction,
        Locale.EnglishUS,
        mockComponentIdBuilder,
      );

      // Assert
      expect(interaction.editReply).toHaveBeenCalledWith({
        content: "add-task.actions.delete.error",
      });
    });

    it("should handle task name with colons correctly", async () => {
      // Arrange
      const interaction = createMockInteraction({
        values: ["complete:task-789:Task: with: colons"],
      });

      // Act
      await actionHandler.handleTaskAction(
        interaction,
        Locale.EnglishUS,
        mockComponentIdBuilder,
      );

      // Assert
      expect(todoistClientMock.closeTask).toHaveBeenCalledWith("user-123", "task-789");
      expect(clientMock.getTranslationHandler().translateCommon).toHaveBeenCalledWith(
        Locale.EnglishUS,
        "add-task.actions.complete.success",
        { task: "Task: with: colons" },
      );
    });

    describe("subtask action", () => {
      it("should show modal and create subtask with parentId", async () => {
        // Arrange
        const modalSubmission = { reply: jest.fn() };
        const modalData: TaskAddModalData = {
          content: "New subtask",
          description: "Subtask description",
          project: "proj-1",
          priority: 3,
          dueDateString: undefined,
          submission: modalSubmission as any,
        };

        const mockBuild = jest.fn().mockReturnValue("built-modal");
        const mockAwaitSubmit = jest.fn().mockResolvedValue(modalData);
        (TaskAddModal as jest.MockedClass<typeof TaskAddModal>)
          .mockImplementation(
            () => ({ build: mockBuild, awaitSubmit: mockAwaitSubmit }) as any,
          );

        const interaction = createMockInteraction({
          values: ["subtask:parent-task-123:Parent task"],
        });

        // Act
        await actionHandler.handleTaskAction(
          interaction,
          Locale.EnglishUS,
          mockComponentIdBuilder,
        );

        // Assert
        expect(todoistClientMock.getUserApi).toHaveBeenCalledWith("user-123");
        expect(interaction.showModal).toHaveBeenCalledWith("built-modal");
        expect(todoistClientMock.addTaskBySelectedDate).toHaveBeenCalledWith(
          "user-123",
          undefined,
          expect.objectContaining({
            content: "New subtask",
            parentId: "parent-task-123",
          }),
          expect.anything(),
        );
        // returns content with action components
        expect(modalSubmission.reply).toHaveBeenCalledWith(
          expect.objectContaining({
            content: "add-task.actions.subtask.success",
            components: expect.any(Array),
            flags: MessageFlags.Ephemeral,
          }),
        );
      });

      it("should show session error when OAuthError on getUserApi for subtask", async () => {
        // Arrange
        (todoistClientMock.getUserApi as jest.Mock)
          .mockRejectedValue(new OAuthError("Session expired"));

        const interaction = createMockInteraction({
          values: ["subtask:task-123:Task"],
        });

        // Act
        await actionHandler.handleTaskAction(
          interaction,
          Locale.EnglishUS,
          mockComponentIdBuilder,
        );

        // Assert
        expect(interaction.reply).toHaveBeenCalledWith({
          content: "session.invalid",
          flags: MessageFlags.Ephemeral,
        });
        expect(interaction.showModal).not.toHaveBeenCalled();
      });

      it("should show error when subtask creation fails", async () => {
        // Arrange
        const modalSubmission = { reply: jest.fn() };
        const modalData: TaskAddModalData = {
          content: "New subtask",
          submission: modalSubmission as any,
        };

        const mockBuild = jest.fn().mockReturnValue("built-modal");
        const mockAwaitSubmit = jest.fn().mockResolvedValue(modalData);
        (TaskAddModal as jest.MockedClass<typeof TaskAddModal>)
          .mockImplementation(
            () => ({ build: mockBuild, awaitSubmit: mockAwaitSubmit }) as any,
          );

        (todoistClientMock.addTaskBySelectedDate as jest.Mock)
          .mockRejectedValue(new Error("API error"));

        const interaction = createMockInteraction({
          values: ["subtask:task-123:Task"],
        });

        // Act
        await actionHandler.handleTaskAction(
          interaction,
          Locale.EnglishUS,
          mockComponentIdBuilder,
        );

        // Assert - error reply goes to modal submission, not original interaction
        expect(modalSubmission.reply).toHaveBeenCalledWith({
          content: "add-task.actions.subtask.error",
          flags: MessageFlags.Ephemeral,
        });
      });
    });

    describe("edit action", () => {
      it("should fetch task, show prefilled modal, and update task", async () => {
        // Arrange
        const modalSubmission = { reply: jest.fn() };
        const modalData: TaskAddModalData = {
          content: "Updated task content",
          description: "Updated description",
          project: "proj-1",
          priority: 1,
          dueDateString: undefined,
          submission: modalSubmission as any,
        };

        const mockBuild = jest.fn().mockReturnValue("built-modal");
        const mockAwaitSubmit = jest.fn().mockResolvedValue(modalData);
        (TaskAddModal as jest.MockedClass<typeof TaskAddModal>)
          .mockImplementation(
            () => ({ build: mockBuild, awaitSubmit: mockAwaitSubmit }) as any,
          );

        const interaction = createMockInteraction({
          values: ["edit:task-123:Original task"],
        });

        // Act
        await actionHandler.handleTaskAction(
          interaction,
          Locale.EnglishUS,
          mockComponentIdBuilder,
        );

        // Assert
        expect(todoistClientMock.getTask).toHaveBeenCalledWith(
          "user-123",
          "task-123",
          expect.anything(),
        );
        expect(TaskAddModal).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.objectContaining({
            content: "Test task",
            description: "Test description",
            priority: 2,
          }),
          "edit",
        );
        expect(todoistClientMock.updateTask).toHaveBeenCalledWith(
          "user-123",
          "task-123",
          expect.objectContaining({
            content: "Updated task content",
            description: "Updated description",
            priority: 1,
          }),
          expect.anything(),
        );
        // Edit action returns simple success message without action components
        expect(modalSubmission.reply).toHaveBeenCalledWith({
          content: "add-task.actions.edit.success",
          flags: MessageFlags.Ephemeral,
        });
      });

      it("should show session error when OAuthError on getUserApi for edit", async () => {
        // Arrange
        (todoistClientMock.getUserApi as jest.Mock)
          .mockRejectedValue(new OAuthError("Session expired"));

        const interaction = createMockInteraction({
          values: ["edit:task-123:Task"],
        });

        // Act
        await actionHandler.handleTaskAction(
          interaction,
          Locale.EnglishUS,
          mockComponentIdBuilder,
        );

        // Assert
        expect(interaction.reply).toHaveBeenCalledWith({
          content: "session.invalid",
          flags: MessageFlags.Ephemeral,
        });
        expect(todoistClientMock.getTask).not.toHaveBeenCalled();
      });

      it("should show session error when OAuthError on getTask", async () => {
        // Arrange
        (todoistClientMock.getTask as jest.Mock)
          .mockRejectedValue(new OAuthError("Session expired"));

        const interaction = createMockInteraction({
          values: ["edit:task-123:Task"],
        });

        // Act
        await actionHandler.handleTaskAction(
          interaction,
          Locale.EnglishUS,
          mockComponentIdBuilder,
        );

        // Assert
        expect(interaction.reply).toHaveBeenCalledWith({
          content: "session.invalid",
          flags: MessageFlags.Ephemeral,
        });
        expect(interaction.showModal).not.toHaveBeenCalled();
      });

      it("should show error when getTask fails with non-OAuth error", async () => {
        // Arrange
        (todoistClientMock.getTask as jest.Mock)
          .mockRejectedValue(new Error("API error"));

        const interaction = createMockInteraction({
          values: ["edit:task-123:Task"],
        });

        // Act
        await actionHandler.handleTaskAction(
          interaction,
          Locale.EnglishUS,
          mockComponentIdBuilder,
        );

        // Assert
        expect(interaction.reply).toHaveBeenCalledWith({
          content: "add-task.actions.edit.error",
          flags: MessageFlags.Ephemeral,
        });
        expect(interaction.showModal).not.toHaveBeenCalled();
      });

      it("should show error when updateTask fails", async () => {
        // Arrange
        const modalSubmission = { reply: jest.fn() };
        const modalData: TaskAddModalData = {
          content: "Updated",
          submission: modalSubmission as any,
        };

        const mockBuild = jest.fn().mockReturnValue("built-modal");
        const mockAwaitSubmit = jest.fn().mockResolvedValue(modalData);
        (TaskAddModal as jest.MockedClass<typeof TaskAddModal>)
          .mockImplementation(
            () => ({ build: mockBuild, awaitSubmit: mockAwaitSubmit }) as any,
          );

        (todoistClientMock.updateTask as jest.Mock)
          .mockRejectedValue(new Error("API error"));

        const interaction = createMockInteraction({
          values: ["edit:task-123:Task"],
        });

        // Act
        await actionHandler.handleTaskAction(
          interaction,
          Locale.EnglishUS,
          mockComponentIdBuilder,
        );

        // Assert - error reply goes to modal submission, not original interaction
        expect(modalSubmission.reply).toHaveBeenCalledWith({
          content: "add-task.actions.edit.error",
          flags: MessageFlags.Ephemeral,
        });
      });
    });
  });

  describe("buildActionsSelectMenu", () => {
    it("should include subtask and edit options in correct order before complete and delete", async () => {
      // Arrange
      const task: Partial<Task> = {
        id: "task-123",
        content: "Test task",
        url: "https://todoist.com/task/123",
        projectId: "proj-1",
        due: null as any,
      };

      // Act
      const response = handler.buildSuccessResponse(
        task as Task,
        language,
        mockComponentIdBuilder,
      );

      // Assert
      const actionRow = response.components?.[0] as any;
      expect(actionRow).toBeDefined();
      const selectMenu = actionRow.components?.[0] as any;
      expect(selectMenu).toBeDefined();
      const options = selectMenu.options;
      expect(options).toHaveLength(4);
      expect(options[0].data.value).toContain("subtask:");
      expect(options[1].data.value).toContain("edit:");
      expect(options[2].data.value).toContain("complete:");
      expect(options[3].data.value).toContain("delete:");
    });
  });
});
