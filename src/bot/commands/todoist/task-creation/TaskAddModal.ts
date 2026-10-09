import type { TranslationHandler } from "@bot/handlers/TranslationHandler";
import type { Locale, ModalSubmitInteraction } from "discord.js";
import { DueStringSelectionOptions } from "@services/todoist/TodoistApiClient";
import {
  LabelBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

/** Available modal modes for the task modal. */
export enum TaskAddModalMode {
  Add = "add",
  Subtask = "subtask",
  Edit = "edit",
}

/** Optional values to pre-fill the modal fields. */
export interface TaskAddModalPrefill {
  content?: string;
  description?: string;
  priority?: number;
  dueDate?: DueStringSelectionOptions;
  project?: string;
}

/** Data extracted from the submitted modal. */
export interface TaskAddModalData {
  content: string;
  description?: string;
  project?: string;
  priority?: number;
  dueDateString?: DueStringSelectionOptions;
  submission: ModalSubmitInteraction;
}

/** A project option to display in the project select menu. */
export interface ProjectOption {
  id: string;
  name: string;
}

interface InteractionWithModalSubmission {
  awaitModalSubmit: (options: {
    time: number;
    filter: (i: ModalSubmitInteraction) => boolean;
  }) => Promise<ModalSubmitInteraction>;
}

/**
 * Encapsulates the "Add Task" modal with construction and field extraction,
 * purely focused on the Discord UI aspect.
 */
export class TaskAddModal {
  private static readonly CUSTOM_ID_PREFIX = "task_add_modal";
  private static readonly FIELD_CONTENT = "task_content";
  private static readonly FIELD_DESCRIPTION = "task_description";
  private static readonly FIELD_PROJECT = "task_project";
  private static readonly FIELD_PRIORITY = "task_priority";
  private static readonly FIELD_DUE_DATE = "task_due_date";
  private static readonly DEFAULT_PRIORITY = 4;
  public static readonly PROJECT_NONE_VALUE = "none";

  private static readonly AWAIT_TIMEOUT_MS = 10 * 60_000;

  private readonly customId: string;

  constructor(
    private readonly projects: ProjectOption[],
    private readonly translationHandler: TranslationHandler,
    private readonly language: Locale,
    private readonly priorityEmotes: Record<number, string>,
    private readonly prefill?: TaskAddModalPrefill,
    private readonly mode: TaskAddModalMode = TaskAddModalMode.Add,
  ) {
    this.customId = `${TaskAddModal.CUSTOM_ID_PREFIX}:${Date.now()}`;
  }

  /**
   * Builds the Discord modal with all task fields using LabelBuilder components.
   * @returns the ModalBuilder ready to be shown to the user
   */
  public build(): ModalBuilder {
    const result = new ModalBuilder().setCustomId(this.customId);
    const titleInput = new TextInputBuilder()
      .setCustomId(TaskAddModal.FIELD_CONTENT)
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(500)
      .setPlaceholder(this.translate("title-placeholder"));
    if (this.prefill?.content) {
      titleInput.setValue(this.prefill.content.slice(0, 500));
    }

    const titleLabel = new LabelBuilder()
      .setLabel(this.translate("title"))
      .setTextInputComponent(titleInput);

    /* For subtasks, add description explaining project inheritance */
    if (this.mode === TaskAddModalMode.Subtask) {
      titleLabel.setDescription(this.translate("actions.subtask.project-inherited"));
    }

    const descriptionInput = new TextInputBuilder()
      .setCustomId(TaskAddModal.FIELD_DESCRIPTION)
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(2000)
      .setPlaceholder(this.translate("description-placeholder"));
    if (this.prefill?.description) {
      descriptionInput.setValue(this.prefill.description.slice(0, 2000));
    }

    const descriptionLabel = new LabelBuilder()
      .setLabel(this.translate("description"))
      .setTextInputComponent(descriptionInput);

    const prioritySelect = new StringSelectMenuBuilder()
      .setCustomId(TaskAddModal.FIELD_PRIORITY)
      .setPlaceholder(this.translate("priorities.none"))
      .setRequired(false)
      .addOptions([1, 2, 3, 4].map((priority) => {
        const isDefault = this.prefill?.priority !== undefined
          ? priority === (5 - this.prefill.priority)
          : priority === TaskAddModal.DEFAULT_PRIORITY;
        return new StringSelectMenuOptionBuilder()
          .setLabel(this.translate(`priorities.${priority}`))
          .setValue((5 - priority).toString())
          .setDefault(isDefault)
          .setEmoji(this.priorityEmotes[priority] ?? "");
      }));
    const priorityLabel = new LabelBuilder()
      .setLabel(this.translate("priorities.label"))
      .setStringSelectMenuComponent(prioritySelect);

    const dueDateOptions = [
      { key: "none", value: "none" },
      { key: "today", value: DueStringSelectionOptions.Today },
      { key: "tomorrow", value: DueStringSelectionOptions.Tomorrow },
      { key: "next-monday", value: DueStringSelectionOptions.NextMonday },
      { key: "next-week", value: DueStringSelectionOptions.NextWeek },
      { key: "next-month", value: DueStringSelectionOptions.NextMonth },
    ];
    const dueDateSelect = new StringSelectMenuBuilder()
      .setCustomId(TaskAddModal.FIELD_DUE_DATE)
      .setPlaceholder(this.translate("due-date.none"))
      .setRequired(false)
      .addOptions(
        dueDateOptions.map(({ key, value }) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(this.translate(`due-date.${key}`))
            .setValue(value)
            .setDefault(this.prefill?.dueDate === value)),
      );
    const dueDateLabel = new LabelBuilder()
      .setLabel(this.translate("due-date.label"))
      .setStringSelectMenuComponent(dueDateSelect);

    const titleKey = this.mode === TaskAddModalMode.Subtask
      ? "subtask-modal-title"
      : this.mode === TaskAddModalMode.Edit
        ? "edit-modal-title"
        : "modal-title";

    result.setTitle(this.translate(titleKey));

    if (this.mode === TaskAddModalMode.Subtask) {
      result.addLabelComponents(
        titleLabel,
        descriptionLabel,
        priorityLabel,
        dueDateLabel,
      );
    } else { // add a project selector for main tasks
      const projectSelect = new StringSelectMenuBuilder()
        .setCustomId(TaskAddModal.FIELD_PROJECT)
        .setPlaceholder(this.translate("project-none"))
        .setRequired(false)
        .addOptions(
          this.projects.length > 0
            ? this.projects.map(p =>
                new StringSelectMenuOptionBuilder()
                  .setLabel(p.name)
                  .setValue(p.id)
                  .setDefault(p.id === this.prefill?.project))
            : [new StringSelectMenuOptionBuilder()
                .setLabel(this.translate("project-none"))
                .setValue(TaskAddModal.PROJECT_NONE_VALUE)],
        );
      const projectLabel = new LabelBuilder()
        .setLabel(this.translate("project"))
        .setStringSelectMenuComponent(projectSelect);

      result.addLabelComponents(
        titleLabel,
        descriptionLabel,
        projectLabel,
        priorityLabel,
        dueDateLabel,
      );
    }

    return result;
  }

  /**
   * Awaits the modal submission and extracts field values.
   *
   * @param interaction the command interaction that showed the modal
   * @returns the extracted modal data including the submission interaction
   * @throws {Error} if the modal times out (user did not submit)
   */
  public async awaitSubmit(
    interaction: InteractionWithModalSubmission,
  ): Promise<TaskAddModalData> {
    const submission = await interaction.awaitModalSubmit({
      time: TaskAddModal.AWAIT_TIMEOUT_MS,
      filter: (i: ModalSubmitInteraction) => i.customId === this.customId,
    });

    const projectValues = this.mode !== TaskAddModalMode.Subtask
      ? submission.fields.getStringSelectValues(TaskAddModal.FIELD_PROJECT)
      : []; // no project field in subtask creation
    const priorityValues = submission.fields.getStringSelectValues(
      TaskAddModal.FIELD_PRIORITY,
    );
    const dueDateValues = submission.fields.getStringSelectValues(
      TaskAddModal.FIELD_DUE_DATE,
    );

    return {
      content: submission.fields.getTextInputValue(TaskAddModal.FIELD_CONTENT),
      description: submission.fields.getTextInputValue(TaskAddModal.FIELD_DESCRIPTION)
        || undefined,
      project: projectValues.length > 0 ? projectValues[0] : undefined,
      priority: priorityValues.length > 0
        ? Number.parseInt(priorityValues[0], 10)
        : undefined,
      dueDateString: dueDateValues.length > 0 && dueDateValues[0] !== "none"
        ? dueDateValues[0] as DueStringSelectionOptions
        : undefined,
      submission,
    };
  }

  private translate(key: string, options?: Record<string, string>): string {
    return this.translationHandler.translateCommon(
      this.language,
      `add-task.${key}`,
      options,
    );
  }
}
