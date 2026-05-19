import type { ModalSubmitInteraction } from "discord.js";
import {
  LabelBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

/** Optional values to pre-fill the modal fields. */
export interface TaskAddModalPrefill {
  content?: string;
  description?: string;
}

/** Data extracted from the submitted modal. */
export interface TaskAddModalData {
  content: string;
  description: string | undefined;
  project: string | undefined;
  priority: number | undefined;
  dueString: string | undefined;
  submission: ModalSubmitInteraction;
}

/** A project option to display in the project select menu. */
export interface ProjectOption {
  id: string;
  name: string;
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

  private static readonly AWAIT_TIMEOUT_MS = 10 * 60_000;

  private readonly customId: string;

  constructor(
    private readonly projects: ProjectOption[],
    private readonly prefill?: TaskAddModalPrefill,
  ) {
    this.customId = `${TaskAddModal.CUSTOM_ID_PREFIX}:${Date.now()}`;
  }

  /**
   * Builds the Discord modal with all task fields using LabelBuilder components.
   * @returns the ModalBuilder ready to be shown to the user
   */
  public build(): ModalBuilder {
    const titleInput = new TextInputBuilder()
      .setCustomId(TaskAddModal.FIELD_CONTENT)
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(500)
      .setPlaceholder("e.g. Buy groceries");
    if (this.prefill?.content) {
      titleInput.setValue(this.prefill.content.slice(0, 500));
    }

    const titleLabel = new LabelBuilder()
      .setLabel("Task title")
      .setTextInputComponent(titleInput);

    const descriptionInput = new TextInputBuilder()
      .setCustomId(TaskAddModal.FIELD_DESCRIPTION)
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(2000)
      .setPlaceholder("Additional details (optional)");
    if (this.prefill?.description) {
      descriptionInput.setValue(this.prefill.description.slice(0, 2000));
    }

    const descriptionLabel = new LabelBuilder()
      .setLabel("Description")
      .setTextInputComponent(descriptionInput);

    const projectSelect = new StringSelectMenuBuilder()
      .setCustomId(TaskAddModal.FIELD_PROJECT)
      .setPlaceholder("Inbox")
      .setRequired(false)
      .addOptions(
        this.projects.map(p =>
          new StringSelectMenuOptionBuilder().setLabel(p.name).setValue(p.id)),
      );
    const projectLabel = new LabelBuilder()
      .setLabel("Project")
      .setStringSelectMenuComponent(projectSelect);

    const prioritySelect = new StringSelectMenuBuilder()
      .setCustomId(TaskAddModal.FIELD_PRIORITY)
      .setPlaceholder("None")
      .setRequired(false)
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel("Priority 1 (Urgent)").setValue("1"),
        new StringSelectMenuOptionBuilder().setLabel("Priority 2 (High)").setValue("2"),
        new StringSelectMenuOptionBuilder().setLabel("Priority 3 (Medium)").setValue("3"),
        new StringSelectMenuOptionBuilder().setLabel("Priority 4 (Low)").setValue("4"),
      );
    const priorityLabel = new LabelBuilder()
      .setLabel("Priority")
      .setStringSelectMenuComponent(prioritySelect);

    const dueDateSelect = new StringSelectMenuBuilder()
      .setCustomId(TaskAddModal.FIELD_DUE_DATE)
      .setPlaceholder("No due date")
      .setRequired(false)
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel("No due date").setValue("none"),
        new StringSelectMenuOptionBuilder().setLabel("Today").setValue("today"),
        new StringSelectMenuOptionBuilder().setLabel("Tomorrow").setValue("tomorrow"),
        new StringSelectMenuOptionBuilder().setLabel("Next week").setValue("next week"),
      );
    const dueDateLabel = new LabelBuilder()
      .setLabel("Due date")
      .setStringSelectMenuComponent(dueDateSelect);

    return new ModalBuilder()
      .setCustomId(this.customId)
      .setTitle("Add a task")
      .addLabelComponents(
        titleLabel,
        descriptionLabel,
        projectLabel,
        priorityLabel,
        dueDateLabel,
      );
  }

  /**
   * Awaits the modal submission and extracts field values.
   *
   * @param interaction the command interaction that showed the modal
   * @returns the extracted modal data including the submission interaction
   * @throws {Error} if the modal times out (user did not submit)
   */
  public async awaitSubmit(
    interaction: { awaitModalSubmit: (options: {
      time: number;
      filter: (i: ModalSubmitInteraction) => boolean;
    }) => Promise<ModalSubmitInteraction>; },
  ): Promise<TaskAddModalData> {
    const submission = await interaction.awaitModalSubmit({
      time: TaskAddModal.AWAIT_TIMEOUT_MS,
      filter: (i: ModalSubmitInteraction) => i.customId === this.customId,
    });

    const content = submission.fields.getTextInputValue(TaskAddModal.FIELD_CONTENT);
    const description = submission.fields.getTextInputValue(TaskAddModal.FIELD_DESCRIPTION) || undefined;

    const projectValues = submission.fields.getStringSelectValues(TaskAddModal.FIELD_PROJECT);
    const project = projectValues.length > 0 ? projectValues[0] : undefined;

    const priorityValues = submission.fields.getStringSelectValues(TaskAddModal.FIELD_PRIORITY);
    const priority = priorityValues.length > 0 ? Number.parseInt(priorityValues[0], 10) : undefined;

    const dueDateValues = submission.fields.getStringSelectValues(TaskAddModal.FIELD_DUE_DATE);
    const dueString = dueDateValues.length > 0 && dueDateValues[0] !== "none"
      ? dueDateValues[0]
      : undefined;

    return { content, description, project, priority, dueString, submission };
  }
}
