import type { TranslationHandler } from "@bot/handlers/TranslationHandler";
import type { ModalSubmitInteraction } from "discord.js";
import { TaskAddModal } from "@bot/commands/todoist/task-creation/TaskAddModal";
import { DueStringSelectionOptions } from "@services/todoist/TodoistApiClient";
import { Locale } from "discord.js";

describe("TaskAddModal", () => {
  const language = Locale.EnglishUS;
  const emotes = {
    1: "p1_emote",
    2: "p2_emote",
    3: "p3_emote",
    4: "p4_emote",
  };
  let translationHandlerMock: TranslationHandler;

  beforeEach(() => {
    translationHandlerMock = {
      translateCommon: jest.fn().mockImplementation(
        (_lang: Locale, key: string) => key,
      ),
    } as unknown as TranslationHandler;
  });

  describe("Constructor", () => {
    it("should create an instance with projects", () => {
      // Arrange
      const projects = [{ id: "1", name: "Project A" }];

      // Act
      const modal
        = new TaskAddModal(projects, translationHandlerMock, language, emotes);

      // Assert
      expect(modal).toBeInstanceOf(TaskAddModal);
    });

    it("should create an instance without projects", () => {
      // Act
      const modal = new TaskAddModal([], translationHandlerMock, language, emotes);

      // Assert
      expect(modal).toBeInstanceOf(TaskAddModal);
    });

    it("should create an instance with prefill values", () => {
      // Arrange
      const prefill = { content: "My task", description: "Details" };

      // Act
      const modal
        = new TaskAddModal([], translationHandlerMock, language, emotes, prefill);

      // Assert
      expect(modal).toBeInstanceOf(TaskAddModal);
    });

    it("should initialize customId with the expected prefix", () => {
      // Act
      const modal = new TaskAddModal([], translationHandlerMock, language, emotes);

      // Assert
      expect((modal as any).customId).toMatch(/^task_add_modal:\d+$/);
    });
  });

  describe("build", () => {
    it("should return a modal with the correct title translation", () => {
      // Arrange
      const modal = new TaskAddModal([], translationHandlerMock, language, emotes);

      // Act
      const built = modal.build();
      const json = built.toJSON();

      // Assert
      expect(json.title).toBe("add-task.modal-title");
    });

    it("should include a custom ID starting with the expected prefix", () => {
      // Arrange
      const modal = new TaskAddModal([], translationHandlerMock, language, emotes);

      // Act
      const built = modal.build();
      const json = built.toJSON();

      // Assert
      expect(json.custom_id).toMatch(/^task_add_modal:\d+$/);
    });

    it("should contain label components", () => {
      // Arrange
      const modal = new TaskAddModal([], translationHandlerMock, language, emotes);

      // Act
      const built = modal.build();
      const json = built.toJSON();

      // Assert
      expect(json.components.length).toBeGreaterThan(0);
    });

    it("should have a required title text input as the first component", () => {
      // Arrange
      const modal = new TaskAddModal([], translationHandlerMock, language, emotes);

      // Act
      const built = modal.build();
      const json = built.toJSON();
      const titleLabel = json.components[0] as any;

      // Assert
      expect(titleLabel.component.custom_id).toBe("task_content");
      expect(titleLabel.component.required).toBe(true);
      expect(titleLabel.component.max_length).toBe(500);
    });

    it("should have an optional description text input as the second component", () => {
      // Arrange
      const modal = new TaskAddModal([], translationHandlerMock, language, emotes);

      // Act
      const built = modal.build();
      const json = built.toJSON();
      const descLabel = json.components[1] as any;

      // Assert
      expect(descLabel.component.custom_id).toBe("task_description");
      expect(descLabel.component.required).toBe(false);
    });

    it("should pre-fill title when prefill content is provided", () => {
      // Arrange
      const prefill = { content: "Prefilled title" };
      const modal
        = new TaskAddModal([], translationHandlerMock, language, emotes, prefill);

      // Act
      const built = modal.build();
      const json = built.toJSON();
      const titleLabel = json.components[0] as any;

      // Assert
      expect(titleLabel.component.value).toBe("Prefilled title");
    });

    it("should truncate prefilled content to 500 characters", () => {
      // Arrange
      const longContent = "A".repeat(600);
      const modal = new TaskAddModal(
        [],
        translationHandlerMock,
        language,
        emotes,
        { content: longContent },
      );

      // Act
      const built = modal.build();
      const json = built.toJSON();
      const titleLabel = json.components[0] as any;

      // Assert
      expect(titleLabel.component.value).toHaveLength(500);
    });

    it("should pre-fill description when prefill description is provided", () => {
      // Arrange
      const prefill = { description: "Prefilled description" };
      const modal
        = new TaskAddModal([], translationHandlerMock, language, emotes, prefill);

      // Act
      const built = modal.build();
      const json = built.toJSON();
      const descLabel = json.components[1] as any;

      // Assert
      expect(descLabel.component.value).toBe("Prefilled description");
    });

    it("should truncate prefilled description to 2000 characters", () => {
      // Arrange
      const longDescription = "B".repeat(2500);
      const modal = new TaskAddModal(
        [],
        translationHandlerMock,
        language,
        emotes,
        { description: longDescription },
      );

      // Act
      const built = modal.build();
      const json = built.toJSON();
      const descLabel = json.components[1] as any;

      // Assert
      expect(descLabel.component.value).toHaveLength(2000);
    });

    describe("project select menu", () => {
      it("should show project options when projects are provided", () => {
        // Arrange
        const projects = [
          { id: "proj1", name: "Work" },
          { id: "proj2", name: "Personal" },
        ];
        const modal
          = new TaskAddModal(projects, translationHandlerMock, language, emotes);

        // Act
        const built = modal.build();
        const json = built.toJSON();
        const projectLabel = json.components[2] as any;

        // Assert
        expect(projectLabel.component.options).toHaveLength(2);
        expect(projectLabel.component.options[0]).toEqual(
          expect.objectContaining({ label: "Work", value: "proj1" }),
        );
        expect(projectLabel.component.options[1]).toEqual(
          expect.objectContaining({ label: "Personal", value: "proj2" }),
        );
      });

      it("should show a 'none' option when no projects are provided", () => {
        // Arrange
        const modal
          = new TaskAddModal([], translationHandlerMock, language, emotes);

        // Act
        const built = modal.build();
        const json = built.toJSON();
        const projectLabel = json.components[2] as any;

        // Assert
        expect(projectLabel.component.options).toHaveLength(1);
        expect(projectLabel.component.options[0].value)
          .toBe(TaskAddModal.PROJECT_NONE_VALUE);
      });
    });

    describe("priority select menu", () => {
      it("should have four priority options", () => {
        // Arrange
        const modal
          = new TaskAddModal([], translationHandlerMock, language, emotes);

        // Act
        const built = modal.build();
        const json = built.toJSON();
        const priorityLabel = json.components[3] as any;

        // Assert
        expect(priorityLabel.component.options).toHaveLength(4);
      });

      it("should store inverted priority values (5 - display)", () => {
        // Arrange
        const modal
          = new TaskAddModal([], translationHandlerMock, language, emotes);

        // Act
        const built = modal.build();
        const json = built.toJSON();
        const priorityLabel = json.components[3] as any;

        // Assert
        expect(priorityLabel.component.options[0].value).toBe("4");
        expect(priorityLabel.component.options[1].value).toBe("3");
        expect(priorityLabel.component.options[2].value).toBe("2");
        expect(priorityLabel.component.options[3].value).toBe("1");
      });

      it("should include priority emojis from config", () => {
        // Arrange
        const modal
          = new TaskAddModal([], translationHandlerMock, language, emotes);

        // Act
        const built = modal.build();
        const json = built.toJSON();
        const priorityLabel = json.components[3] as any;

        // Assert
        expect(priorityLabel.component.options[0].emoji)
          .toEqual(expect.objectContaining({ name: "p1_emote" }));
        expect(priorityLabel.component.options[1].emoji)
          .toEqual(expect.objectContaining({ name: "p2_emote" }));
        expect(priorityLabel.component.options[2].emoji)
          .toEqual(expect.objectContaining({ name: "p3_emote" }));
        expect(priorityLabel.component.options[3].emoji)
          .toEqual(expect.objectContaining({ name: "p4_emote" }));
      });

      it("should have the default priority option selected", () => {
        // Arrange
        const modal
          = new TaskAddModal([], translationHandlerMock, language, emotes);

        // Act
        const built = modal.build();
        const json = built.toJSON();
        const priorityLabel = json.components[3] as any;

        // Assert
        expect(priorityLabel.component.options[0].default).toBe(false);
        expect(priorityLabel.component.options[1].default).toBe(false);
        expect(priorityLabel.component.options[2].default).toBe(false);
        expect(priorityLabel.component.options[3].default).toBe(true);
      });
    });

    describe("due date select menu", () => {
      it("should contain all DueStringSelectionOptions plus a none option", () => {
        // Arrange
        const modal = new TaskAddModal([], translationHandlerMock, language, emotes);

        // Act
        const built = modal.build();
        const json = built.toJSON();
        const dueDateLabel = json.components[4] as any;

        // Assert
        expect(dueDateLabel.component.options).toHaveLength(6);

        const values = dueDateLabel.component.options.map((o: any) => o.value);
        expect(values).toContain("none");
        expect(values).toContain(DueStringSelectionOptions.Today);
        expect(values).toContain(DueStringSelectionOptions.Tomorrow);
        expect(values).toContain(DueStringSelectionOptions.NextMonday);
        expect(values).toContain(DueStringSelectionOptions.NextWeek);
        expect(values).toContain(DueStringSelectionOptions.NextMonth);
      });
    });
  });

  describe("awaitSubmit", () => {
    it("should return extracted modal data on successful submission", async () => {
      // Arrange
      const modal = new TaskAddModal([], translationHandlerMock, language, emotes);
      modal.build();

      const submissionMock = {
        customId: expect.any(String),
        fields: {
          getTextInputValue: jest.fn().mockImplementation((id: string) => {
            if (id === "task_content")
              return "My task";
            if (id === "task_description")
              return "Some desc";
            return "";
          }),
          getStringSelectValues: jest.fn().mockImplementation((id: string) => {
            if (id === "task_project")
              return ["proj1"];
            if (id === "task_priority")
              return ["4"];
            if (id === "task_due_date")
              return [DueStringSelectionOptions.Today];
            return [];
          }),
        },
      } as unknown as ModalSubmitInteraction;

      const interaction = {
        awaitModalSubmit: jest.fn().mockResolvedValue(submissionMock),
      };

      // Act
      const result = await modal.awaitSubmit(interaction);

      // Assert
      expect(result.content).toBe("My task");
      expect(result.description).toBe("Some desc");
      expect(result.project).toBe("proj1");
      expect(result.priority).toBe(4);
      expect(result.dueDateString).toBe(DueStringSelectionOptions.Today);
      expect(result.submission).toBe(submissionMock);
    });

    it("should return undefined description when field is empty", async () => {
      // Arrange
      const modal = new TaskAddModal([], translationHandlerMock, language, emotes);
      modal.build();

      const submissionMock = {
        fields: {
          getTextInputValue: jest.fn().mockImplementation((id: string) => {
            if (id === "task_content")
              return "Task";
            return "";
          }),
          getStringSelectValues: jest.fn().mockReturnValue([]),
        },
      } as unknown as ModalSubmitInteraction;

      const interaction = {
        awaitModalSubmit: jest.fn().mockResolvedValue(submissionMock),
      };

      // Act
      const result = await modal.awaitSubmit(interaction);

      // Assert
      expect(result.description).toBeUndefined();
    });

    it("should return undefined project when no project is selected", async () => {
      // Arrange
      const modal = new TaskAddModal([], translationHandlerMock, language, emotes);
      modal.build();

      const submissionMock = {
        fields: {
          getTextInputValue: jest.fn().mockReturnValue("Task"),
          getStringSelectValues: jest.fn().mockReturnValue([]),
        },
      } as unknown as ModalSubmitInteraction;

      const interaction = {
        awaitModalSubmit: jest.fn().mockResolvedValue(submissionMock),
      };

      // Act
      const result = await modal.awaitSubmit(interaction);

      // Assert
      expect(result.project).toBeUndefined();
    });

    it("should return undefined priority when no priority is selected", async () => {
      // Arrange
      const modal = new TaskAddModal([], translationHandlerMock, language, emotes);
      modal.build();

      const submissionMock = {
        fields: {
          getTextInputValue: jest.fn().mockReturnValue("Task"),
          getStringSelectValues: jest.fn().mockReturnValue([]),
        },
      } as unknown as ModalSubmitInteraction;

      const interaction = {
        awaitModalSubmit: jest.fn().mockResolvedValue(submissionMock),
      };

      // Act
      const result = await modal.awaitSubmit(interaction);

      // Assert
      expect(result.priority).toBeUndefined();
    });

    it("should return undefined dueDateString when 'none' is selected", async () => {
      // Arrange
      const modal = new TaskAddModal([], translationHandlerMock, language, emotes);
      modal.build();

      const submissionMock = {
        fields: {
          getTextInputValue: jest.fn().mockReturnValue("Task"),
          getStringSelectValues: jest.fn().mockImplementation((id: string) => {
            if (id === "task_due_date")
              return ["none"];
            return [];
          }),
        },
      } as unknown as ModalSubmitInteraction;

      const interaction = {
        awaitModalSubmit: jest.fn().mockResolvedValue(submissionMock),
      };

      // Act
      const result = await modal.awaitSubmit(interaction);

      // Assert
      expect(result.dueDateString).toBeUndefined();
    });

    it("should throw when the modal times out", async () => {
      // Arrange
      const modal = new TaskAddModal([], translationHandlerMock, language, emotes);
      modal.build();

      const interaction = {
        awaitModalSubmit: jest.fn().mockRejectedValue(new Error("Timeout")),
      };

      // Act & Assert
      await expect(modal.awaitSubmit(interaction)).rejects.toThrow("Timeout");
    });

    it("should pass the correct timeout to awaitModalSubmit", async () => {
      // Arrange
      const modal = new TaskAddModal([], translationHandlerMock, language, emotes);
      modal.build();

      const submissionMock = {
        fields: {
          getTextInputValue: jest.fn().mockReturnValue("Task"),
          getStringSelectValues: jest.fn().mockReturnValue([]),
        },
      } as unknown as ModalSubmitInteraction;

      const interaction = {
        awaitModalSubmit: jest.fn().mockResolvedValue(submissionMock),
      };

      // Act
      await modal.awaitSubmit(interaction);

      // Assert
      expect(interaction.awaitModalSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ time: 10 * 60_000 }),
      );
    });
  });
});
