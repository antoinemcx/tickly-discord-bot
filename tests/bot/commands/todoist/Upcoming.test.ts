import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { Task } from "@doist/todoist-api-typescript";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import Upcoming, { UpcomingFilter } from "@bot/commands/todoist/Upcoming";
import { Locale, MessageFlags } from "discord.js";

function localDateStr(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function makeTask(overrides: Partial<{
  id: string;
  content: string;
  priority: number;
  due: { date: string; string: string; datetime?: string | null } | null;
}> = {}): Task {
  return {
    id: "task-1",
    content: "Test task",
    description: "",
    projectId: "project-1",
    priority: 1,
    due: null,
    url: "https://todoist.com/app/task/1",
    labels: [],
    checked: false,
    isDeleted: false,
    ...overrides,
  } as unknown as Task;
}

describe("Upcoming Command", () => {
  const language = Locale.EnglishUS;
  let command: Upcoming;
  let clientMock: Tickly;
  let todoistClientMock: TodoistApiClient;

  beforeEach(() => {
    clientMock = {
      getTranslationHandler: jest.fn().mockReturnValue({
        translateCommand: (_lang: Locale, _cmd: string, key: string) => key,
        translateCommon: (_lang: Locale, key: string) => key,
        getLocales: jest.fn().mockReturnValue([Locale.EnglishUS, Locale.French]),
        getDefaultLocale: jest.fn().mockReturnValue(Locale.EnglishUS),
        getCommandDescriptions: jest.fn().mockReturnValue({ [Locale.EnglishUS]: "description" }),
        getCommandNames: jest.fn().mockReturnValue({}),
      }),
      getCommandMention: jest.fn().mockResolvedValue("/command"),
      getConfig: jest.fn().mockReturnValue({
        emotes: {
          i: "ℹ️",
          x: "❌",
          priorities: { 1: "🔴", 2: "🟠", 3: "🔵", 4: "⚪" },
        },
      }),
    } as unknown as Tickly;

    todoistClientMock = {} as TodoistApiClient;

    command = new Upcoming(
      clientMock,
      todoistClientMock,
      {} as RepositoryFactory,
      "todoist",
    );
  });

  describe("getName", () => {
    it("should return 'upcoming'", () => {
      expect(command.getName()).toBe("upcoming");
    });
  });

  describe("getData", () => {
    it("should include a 'period' option with one localized choice per filter", () => {
      // Act
      const data = command.getData();

      // Assert
      const periodOption = data.options?.find(o => o.name === "period") as any;
      expect(periodOption).toBeDefined();
      expect(Array.isArray(periodOption.choices)).toBe(true);
      expect(periodOption.choices).toHaveLength(Object.values(UpcomingFilter).length);
      const values = periodOption.choices.map((c: any) => c.value);
      expect(values).toEqual(expect.arrayContaining(Object.values(UpcomingFilter)));
      for (const choice of periodOption.choices) {
        expect(typeof choice.name).toBe("string");
        expect(choice.name_localizations).toBeDefined();
      }
    });
  });

  describe("execute", () => {
    let interaction: {
      user: { id: string };
      options: { getString: jest.Mock };
      deferReply: jest.Mock;
      editReply: jest.Mock;
    };

    beforeEach(() => {
      interaction = {
        user: { id: "user123" },
        options: { getString: jest.fn().mockReturnValue(null) },
        deferReply: jest.fn().mockResolvedValue(undefined),
        editReply: jest.fn().mockResolvedValue(undefined),
      };
    });

    describe("when the user has no active session", () => {
      it("should reply with the session.invalid message", async () => {
        // Arrange
        todoistClientMock.getUserApi = jest.fn().mockRejectedValue(
          new Error("No Todoist access token"),
        );

        // Act
        await command.execute(interaction as any, language);

        // Assert
        expect(interaction.deferReply).toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith({
          content: expect.stringContaining("session.invalid"),
        });
      });
    });

    describe("when the user has no active tasks", () => {
      it("should reply with a plain text noTasks message", async () => {
        // Arrange
        todoistClientMock.getUserApi = jest.fn().mockResolvedValue({});
        todoistClientMock.getActiveTasks = jest.fn().mockResolvedValue([]);

        // Act
        await command.execute(interaction as any, language);

        // Assert
        const reply = (interaction.editReply as jest.Mock).mock.calls[0][0];
        expect(reply.content).toContain("noTasks");
        expect(reply.components).toBeUndefined();
      });
    });

    describe("when the user has tasks", () => {
      it("should reply with a ComponentsV2 response", async () => {
        // Arrange
        todoistClientMock.getUserApi = jest.fn().mockResolvedValue({});
        todoistClientMock.getActiveTasks = jest.fn().mockResolvedValue([
          makeTask({ due: { date: localDateStr(0), string: "Today" } }),
        ]);

        // Act
        await command.execute(interaction as any, language);

        // Assert
        const reply = (interaction.editReply as jest.Mock).mock.calls[0][0];
        expect(reply.flags).toBe(MessageFlags.IsComponentsV2);
        expect(Array.isArray(reply.components)).toBe(true);
      });

      it.each([
        ["Today", [makeTask({ due: { date: "2020-01-01", string: "Jan 1" } })], UpcomingFilter.Today],
        ["Tomorrow", [makeTask({ due: { date: localDateStr(1), string: "Tomorrow" } })], UpcomingFilter.Tomorrow],
        ["Week", [makeTask({ due: { date: localDateStr(3), string: "In 3 days" } })], UpcomingFilter.Week],
        ["Upcoming", [makeTask({ due: { date: "2099-12-31", string: "Far future" } })], UpcomingFilter.Upcoming],
      ])("should default to %s filter when only those tasks exist", async (_label, tasks, expectedFilter) => {
        // Arrange
        todoistClientMock.getUserApi = jest.fn().mockResolvedValue({});
        todoistClientMock.getActiveTasks = jest.fn().mockResolvedValue(tasks);

        // Act
        await command.execute(interaction as any, language);

        // Assert
        const containerJson
          = (interaction.editReply as jest.Mock).mock.calls[0][0].components[0].toJSON();
        const filterRow = containerJson.components.find(
          (c: any) => c.type === 1 && c.components?.[0]?.type === 3,
        );
        const selected = filterRow?.components?.[0]?.options?.find((o: any) => o.default);
        expect(selected?.value).toBe(expectedFilter);
      });

      it("should store the selected filter and page 0 in the navigation state", async () => {
        // Arrange
        todoistClientMock.getUserApi = jest.fn().mockResolvedValue({});
        todoistClientMock.getActiveTasks = jest.fn().mockResolvedValue([
          makeTask({ due: { date: "2020-01-01", string: "Jan 1" } }),
        ]);

        // Act
        await command.execute(interaction as any, language);

        // Assert
        const state = (command as any).navigationStates.get("user123");
        expect(state?.filter).toBe(UpcomingFilter.Today);
        expect(state?.page).toBe(0);
      });

      it("should include pagination buttons when tasks exceed one page", async () => {
        // Arrange
        const tasks = Array.from({ length: 11 }, (_, i) =>
          makeTask({ id: String(i), due: { date: "2020-01-01", string: "Jan 1" } }));
        todoistClientMock.getUserApi = jest.fn().mockResolvedValue({});
        todoistClientMock.getActiveTasks = jest.fn().mockResolvedValue(tasks);

        // Act
        await command.execute(interaction as any, language);

        // Assert
        const containerJson
          = (interaction.editReply as jest.Mock).mock.calls[0][0].components[0].toJSON();
        const paginationRow = containerJson.components.find(
          (c: any) => c.type === 1 && c.components?.some((b: any) => b.type === 2),
        );
        expect(paginationRow).toBeDefined();
      });

      it("should not include pagination buttons when tasks fit on one page", async () => {
        // Arrange
        const tasks = Array.from({ length: 5 }, (_, i) =>
          makeTask({ id: String(i), due: { date: "2020-01-01", string: "Jan 1" } }));
        todoistClientMock.getUserApi = jest.fn().mockResolvedValue({});
        todoistClientMock.getActiveTasks = jest.fn().mockResolvedValue(tasks);

        // Act
        await command.execute(interaction as any, language);

        // Assert
        const containerJson
          = (interaction.editReply as jest.Mock).mock.calls[0][0].components[0].toJSON();
        const paginationRows = containerJson.components.filter(
          (c: any) => c.type === 1 && c.components?.some((b: any) => b.type === 2),
        );
        expect(paginationRows).toHaveLength(0);
      });
    });

    describe("when the period option is provided", () => {
      it("should use the given period instead of the auto-detected default", async () => {
        // Arrange
        todoistClientMock.getUserApi = jest.fn().mockResolvedValue({});
        todoistClientMock.getActiveTasks = jest.fn().mockResolvedValue([
          makeTask({ due: { date: "2020-01-01", string: "Jan 1" } }),
        ]);
        (interaction.options.getString as jest.Mock).mockReturnValue(UpcomingFilter.Upcoming);

        // Act
        await command.execute(interaction as any, language);

        // Assert
        const containerJson
          = (interaction.editReply as jest.Mock).mock.calls[0][0].components[0].toJSON();
        const filterRow = containerJson.components.find(
          (c: any) => c.type === 1 && c.components?.[0]?.type === 3,
        );
        const selected = filterRow?.components?.[0]?.options?.find((o: any) => o.default);
        expect(selected?.value).toBe(UpcomingFilter.Upcoming);
      });
    });

    describe("when fetching tasks fails", () => {
      it("should reply with a fetchError message", async () => {
        // Arrange
        todoistClientMock.getUserApi = jest.fn().mockResolvedValue({});
        todoistClientMock.getActiveTasks = jest.fn().mockRejectedValue(
          new Error("Todoist API unreachable"),
        );

        // Act
        await command.execute(interaction as any, language);

        // Assert
        expect(interaction.editReply).toHaveBeenCalledWith({
          content: expect.stringContaining("fetchError"),
        });
      });
    });
  });

  describe("change_filter component handler", () => {
    it("should defer, re-fetch tasks and update the message for the selected filter", async () => {
      // Arrange
      const handler = command.getMessageComponentHandlers()
        .get("todoist:upcoming:change_filter")!;
      expect(handler).toBeDefined();
      const interaction = {
        isStringSelectMenu: jest.fn().mockReturnValue(true),
        values: [UpcomingFilter.Tomorrow],
        user: { id: "user123" },
        deferUpdate: jest.fn().mockResolvedValue(undefined),
        editReply: jest.fn().mockResolvedValue(undefined),
        followUp: jest.fn().mockResolvedValue(undefined),
      } as any;
      todoistClientMock.getUserApi = jest.fn().mockResolvedValue({});
      todoistClientMock.getActiveTasks = jest.fn().mockResolvedValue([
        makeTask({ due: { date: localDateStr(1), string: "Tomorrow" } }),
      ]);

      // Act
      await handler(interaction, language);

      // Assert
      expect(interaction.deferUpdate).toHaveBeenCalled();
      expect(todoistClientMock.getActiveTasks).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ flags: MessageFlags.IsComponentsV2 }),
      );
    });

    it("should do nothing when the interaction is not a select menu", async () => {
      // Arrange
      const handler = command.getMessageComponentHandlers()
        .get("todoist:upcoming:change_filter")!;
      const interaction = {
        isStringSelectMenu: jest.fn().mockReturnValue(false),
        deferUpdate: jest.fn(),
      } as any;

      // Act
      await handler(interaction, language);

      // Assert
      expect(interaction.deferUpdate).not.toHaveBeenCalled();
    });

    it("should follow up with an error message when the API call fails", async () => {
      // Arrange
      const handler = command.getMessageComponentHandlers()
        .get("todoist:upcoming:change_filter")!;
      const interaction = {
        isStringSelectMenu: jest.fn().mockReturnValue(true),
        values: [UpcomingFilter.Today],
        user: { id: "user123" },
        deferUpdate: jest.fn().mockResolvedValue(undefined),
        editReply: jest.fn(),
        followUp: jest.fn().mockResolvedValue(undefined),
      } as any;
      todoistClientMock.getUserApi = jest.fn().mockRejectedValue(
        new Error("Session expired"),
      );

      // Act
      await handler(interaction, language);

      // Assert
      expect(interaction.followUp).toHaveBeenCalledWith(
        expect.objectContaining({ flags: MessageFlags.Ephemeral }),
      );
    });
  });

  describe("next_page component handler", () => {
    it("should advance to the next page using the stored navigation state", async () => {
      // Arrange
      const handler = command.getMessageComponentHandlers()
        .get("todoist:upcoming:next_page")!;
      expect(handler).toBeDefined();
      (command as any).navigationStates.set("user123", {
        filter: UpcomingFilter.Today,
        page: 0,
      });
      const interaction = {
        user: { id: "user123" },
        deferUpdate: jest.fn().mockResolvedValue(undefined),
        editReply: jest.fn().mockResolvedValue(undefined),
        followUp: jest.fn().mockResolvedValue(undefined),
      } as any;
      const tasks = Array.from({ length: 11 }, (_, i) =>
        makeTask({ id: String(i), due: { date: "2020-01-01", string: "Jan 1" } }));
      todoistClientMock.getUserApi = jest.fn().mockResolvedValue({});
      todoistClientMock.getActiveTasks = jest.fn().mockResolvedValue(tasks);

      // Act
      await handler(interaction, language);

      // Assert
      expect(interaction.deferUpdate).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ flags: MessageFlags.IsComponentsV2 }),
      );
      expect((command as any).navigationStates.get("user123")?.page).toBe(1);
    });

    it("should follow up with an error message when the API call fails", async () => {
      // Arrange
      const handler = command.getMessageComponentHandlers()
        .get("todoist:upcoming:next_page")!;
      (command as any).navigationStates.set("user123", {
        filter: UpcomingFilter.Today,
        page: 0,
      });
      const interaction = {
        user: { id: "user123" },
        deferUpdate: jest.fn().mockResolvedValue(undefined),
        editReply: jest.fn(),
        followUp: jest.fn().mockResolvedValue(undefined),
      } as any;
      todoistClientMock.getUserApi = jest.fn().mockRejectedValue(
        new Error("Network error"),
      );

      // Act
      await handler(interaction, language);

      // Assert
      expect(interaction.followUp).toHaveBeenCalledWith(
        expect.objectContaining({ flags: MessageFlags.Ephemeral }),
      );
    });
  });

  describe("prev_page component handler", () => {
    it("should go back to the previous page using the stored navigation state", async () => {
      // Arrange
      const handler = command.getMessageComponentHandlers()
        .get("todoist:upcoming:prev_page")!;
      expect(handler).toBeDefined();
      (command as any).navigationStates.set("user123", {
        filter: UpcomingFilter.Today,
        page: 1,
      });
      const interaction = {
        user: { id: "user123" },
        deferUpdate: jest.fn().mockResolvedValue(undefined),
        editReply: jest.fn().mockResolvedValue(undefined),
        followUp: jest.fn().mockResolvedValue(undefined),
      } as any;
      const tasks = Array.from({ length: 11 }, (_, i) =>
        makeTask({ id: String(i), due: { date: "2020-01-01", string: "Jan 1" } }));
      todoistClientMock.getUserApi = jest.fn().mockResolvedValue({});
      todoistClientMock.getActiveTasks = jest.fn().mockResolvedValue(tasks);

      // Act
      await handler(interaction, language);

      // Assert
      expect(interaction.deferUpdate).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ flags: MessageFlags.IsComponentsV2 }),
      );
      expect((command as any).navigationStates.get("user123")?.page).toBe(0);
    });
  });
});
