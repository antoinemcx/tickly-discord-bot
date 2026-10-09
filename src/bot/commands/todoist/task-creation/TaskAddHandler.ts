import type { TranslationHandler } from "@bot/handlers/TranslationHandler";
import type { Task, TodoistApi } from "@doist/todoist-api-typescript";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type { InteractionReplyOptions, Locale, ModalBuilder, ModalSubmitInteraction } from "discord.js";
import type { ProjectOption, TaskAddModalData, TaskAddModalPrefill } from "./TaskAddModal";
import { Tickly } from "@bot/Tickly";
import { OAuthError } from "@services/todoist/errors/OAuthError";
import { TaskNotFoundError } from "@services/todoist/errors/TaskNotFoundError";
import { DueStringSelectionOptions } from "@services/todoist/TodoistApiClient";
import { displayDetailedError, generateErrorCode } from "@src/utils/logger";
import {
  ComponentType,
  MessageFlags,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import { TaskAddModal, TaskAddModalMode } from "./TaskAddModal";

interface Repliable {
  reply: (options: InteractionReplyOptions
    | { content: string; flags: number }) => Promise<unknown>;
}

interface SelectMenuInteraction extends Repliable, InteractionWithModal {
  values: string[];
  user: { id: string };
  deferReply: (options: { flags: number }) => Promise<unknown>;
  editReply: (options: { content: string }) => Promise<unknown>;
}

/**
 * Error thrown when the task-add flow is terminated with modal timeout,
 * cancellation or any fetching error already handled.
 */
export class ModalCancelledError extends Error {
  constructor() {
    super("The modal submission was cancelled or timed out.");
    this.name = "ModalCancelledError";
  }
}

interface InteractionWithModal {
  showModal: (modal: ModalBuilder) => Promise<void>;
  awaitModalSubmit: (options: {
    time: number;
    filter: (i: ModalSubmitInteraction) => boolean;
  }) => Promise<ModalSubmitInteraction>;
}

/**
 * Handles the shared logic for adding a Todoist task:
 * fetching projects, showing the modal, and creating the task via the API.
 */
export class TaskAddHandler {
  /** Action identifier for the select menu component. */
  public static readonly ACTIONS_COMPONENT_ID = "actions";
  /** Value prefix for the "create subtask" action in the select menu. */
  public static readonly ACTION_SUBTASK = "subtask";
  /** Value prefix for the "edit task" action in the select menu. */
  public static readonly ACTION_EDIT = "edit";
  /** Value prefix for the "complete task" action in the select menu. */
  public static readonly ACTION_COMPLETE = "complete";
  /** Value prefix for the "delete task" action in the select menu. */
  public static readonly ACTION_DELETE = "delete";

  private readonly translationHandler: TranslationHandler;
  private readonly priorityEmotes: Record<number, string>;

  private modal: TaskAddModal | undefined;
  private projects: ProjectOption[] = [];
  private projectsFetched = false;

  constructor(
    private readonly todoistClient: TodoistApiClient,
    private readonly client: Tickly,
  ) {
    this.translationHandler = client.getTranslationHandler();
    this.priorityEmotes = client.getConfig().emotes.priorities;
  }

  /**
   * Fetches user projects, builds and shows the "Add Task" modal, and awaits
   * the user's submission.
   *
   * @param interaction the interaction that will receive the modal
   * @param api the authenticated Todoist API instance
   * @param language locale for modal labels
   * @param prefill optional pre-fill data for the modal fields
   * @param mode the modal add or edit mode
   * @returns the submitted modal data
   * @throws {ModalCancelledError} if the user does not submit the modal or
   *         if fetching projects fails (error reply is sent before throwing)
   */
  public async sendAndAwaitModalSubmit(
    interaction: InteractionWithModal & Repliable,
    api: TodoistApi,
    language: Locale,
    prefill?: TaskAddModalPrefill,
    mode: TaskAddModalMode = TaskAddModalMode.Add,
  ): Promise<TaskAddModalData> {
    try {
      await this.loadProjects(api);
    } catch (error) {
      const errorCode = generateErrorCode();
      displayDetailedError("Error fetching Todoist projects", error, errorCode);
      await interaction.reply({
        content: this.translationHandler.translateCommon(
          language,
          "add-task.projects-fetch-error",
          { errorCode },
        ),
        flags: MessageFlags.Ephemeral,
      });
      throw new ModalCancelledError();
    }

    this.modal = new TaskAddModal(
      this.projects,
      this.translationHandler,
      language,
      this.priorityEmotes,
      prefill,
      mode,
    );

    await interaction.showModal(this.modal.build());

    try {
      return await this.modal.awaitSubmit(interaction);
    } catch {
      throw new ModalCancelledError();
    }
  }

  /**
   * Creates a Todoist task from the submitted modal data or a natural language
   * string, and replies to the user with a success or error message.
   *
   * @param userId the Discord user ID
   * @param data the submitted modal data, or a natural language string for quick add
   * @param language locale for reply messages
   * @param componentIdBuilder function to build component customIds (from the command)
   * @param interaction the interaction to reply to (required when data is a string)
   * @param api optional pre-fetched TodoistApi instance
   */
  public async addToTodoist(
    userId: string,
    data: TaskAddModalData | string,
    language: Locale,
    componentIdBuilder: (action: string) => string,
    interaction?: Repliable,
    api?: TodoistApi,
  ): Promise<void> {
    const repliable: Repliable = typeof data === "string"
      ? interaction!
      : data.submission;

    if (api) {
      try {
        await this.loadProjects(api);
      } catch {
        // Non-critical: project name display is best-effort
      }
    }

    let task: Task | undefined;
    try {
      if (typeof data === "string") {
        task = await this.todoistClient.quickAddTask(userId, { text: data }, api);
      } else {
        task = await this.todoistClient.addTaskBySelectedDate(
          userId,
          data.dueDateString,
          {
            content: data.content,
            description: data.description,
            priority: data.priority,
            projectId: data.project !== TaskAddModal.PROJECT_NONE_VALUE
              ? data.project
              : undefined,
          },
          api,
        );
      }
    } catch (error) {
      const errorCode = generateErrorCode();
      displayDetailedError("Error creating Todoist task", error, errorCode);
      await repliable.reply({
        content: this.translationHandler.translateCommon(
          language,
          "add-task.creation-error",
          { errorCode },
        ),
        flags: MessageFlags.Ephemeral,
      });
    }

    if (task) {
      await repliable.reply(
        this.buildSuccessResponse(task, language, componentIdBuilder),
      );
    }
  }

  /**
   * Builds the success response with text content and an actions select menu.
   *
   * @param task the created Todoist task
   * @param language locale for translations
   * @param componentIdBuilder function to build component customIds, from the command
   * @param parentTaskName optional parent task name, for subtask creation
   * @returns the interaction reply options with components
   */
  public buildSuccessResponse(
    task: Task,
    language: Locale,
    componentIdBuilder: (action: string) => string,
    parentTaskName?: string,
  ): InteractionReplyOptions {
    const dateDisplay = task.due?.date
      ? (Tickly.dateStringToDiscordTimestamp(task.due.date) ?? task.due.string)
      : this.translationHandler.translateCommon(language, "add-task.success-no-date");

    const successText = parentTaskName // subtask creation if parent task name
      ? this.translationHandler.translateCommon(language, "add-task.actions.subtask.success", {
          task: TaskAddHandler.truncateTaskName(task.content),
          taskUrl: task.url,
          parentTask: TaskAddHandler.truncateTaskName(parentTaskName),
          date: dateDisplay,
        })
      : this.translationHandler.translateCommon(language, "add-task.success", {
          task: TaskAddHandler.truncateTaskName(task.content),
          taskUrl: task.url,
          project: this.findProjectName(task.projectId)
            || this.translationHandler.translateCommon(language, "add-task.success-no-project"),
          date: dateDisplay,
        });

    const selectMenu = this.buildActionsSelectMenu(task, language, componentIdBuilder);

    return {
      content: successText,
      components: [{
        type: ComponentType.ActionRow,
        components: [selectMenu],
      }],
      flags: MessageFlags.Ephemeral,
    };
  }

  /**
   * Builds the actions select menu for the task success message.
   * Each option value encodes "action:taskId:truncatedTaskName" for parsing.
   */
  private buildActionsSelectMenu(
    task: Task,
    language: Locale,
    componentIdBuilder: (action: string) => string,
  ): StringSelectMenuBuilder {
    const taskNameForValue = task.content.length > 50
      ? task.content.substring(0, 50) // truncate to avoid Discord limit
      : task.content;

    const actions = [
      { action: TaskAddHandler.ACTION_SUBTASK, key: "subtask" },
      { action: TaskAddHandler.ACTION_EDIT, key: "edit" },
      { action: TaskAddHandler.ACTION_COMPLETE, key: "complete" },
      { action: TaskAddHandler.ACTION_DELETE, key: "delete" },
    ] as const;

    return new StringSelectMenuBuilder()
      .setCustomId(componentIdBuilder(TaskAddHandler.ACTIONS_COMPONENT_ID))
      .setPlaceholder(this.translationHandler.translateCommon(
        language,
        "add-task.actions.placeholder",
      ))
      .addOptions(
        actions.map(({ action, key }) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(this.translationHandler.translateCommon(
              language,
              `add-task.actions.${key}.label`,
            ))
            .setValue(`${action}:${task.id}:${taskNameForValue}`)),
      );
  }

  /**
   * Handles task actions from the success message select menu.
   *
   * @param interaction the select menu interaction
   * @param language locale for response messages
   * @param componentIdBuilder function to build component customIds for follow-up
   */
  public async handleTaskAction(
    interaction: SelectMenuInteraction,
    language: Locale,
    componentIdBuilder: (action: string) => string,
  ): Promise<void> {
    const selectedValue = interaction.values[0];
    const parsed = TaskAddHandler.parseActionValue(selectedValue);

    if (!parsed) {
      await interaction.reply({
        content: this.translationHandler.translateCommon(
          language,
          "interactionHandling.executionError",
          { errorCode: "INVALID_ACTION" },
        ),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const userId = interaction.user.id;
    const { action, taskId, taskName } = parsed;

    /* Handle modal-based actions separately */
    if (action === TaskAddHandler.ACTION_SUBTASK
      || action === TaskAddHandler.ACTION_EDIT) {
      await this.handleModalAction(
        interaction,
        language,
        componentIdBuilder,
        action === TaskAddHandler.ACTION_SUBTASK
          ? TaskAddModalMode.Subtask
          : TaskAddModalMode.Edit,
        userId,
        taskId,
        action === TaskAddHandler.ACTION_SUBTASK ? taskName : undefined,
      );
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    /* Handle other atomic actions */
    try {
      if (action === TaskAddHandler.ACTION_COMPLETE) {
        await this.todoistClient.closeTask(userId, taskId);
        await interaction.editReply({
          content: this.translationHandler.translateCommon(
            language,
            "add-task.actions.complete.success",
            { task: taskName },
          ),
        });
      } else if (action === TaskAddHandler.ACTION_DELETE) {
        await this.todoistClient.deleteTask(userId, taskId);
        await interaction.editReply({
          content: this.translationHandler.translateCommon(
            language,
            "add-task.actions.delete.success",
            { task: taskName },
          ),
        });
      }
    } catch (error) {
      await this.handleActionError(
        error,
        action === TaskAddHandler.ACTION_COMPLETE
          ? "add-task.actions.complete.error"
          : "add-task.actions.delete.error",
        language,
        msg => interaction.editReply({ content: msg }),
      );
    }
  }

  /**
   * Unified handler for modal-based actions (subtask and edit).
   * @param interaction the select menu interaction
   * @param language user preferred locale
   * @param componentIdBuilder function to build component customIds for follow-up
   * @param mode the modal mode
   * @param userId the user ID
   * @param taskId the task ID
   * @param parentTaskName the parent task name, for subtask creation
   */
  private async handleModalAction(
    interaction: SelectMenuInteraction,
    language: Locale,
    componentIdBuilder: (action: string) => string,
    mode: TaskAddModalMode.Subtask | TaskAddModalMode.Edit,
    userId: string,
    taskId: string,
    parentTaskName?: string,
  ): Promise<void> {
    const errorKey = mode === TaskAddModalMode.Subtask
      ? "add-task.actions.subtask.error"
      : "add-task.actions.edit.error";

    /* Retrieve API client */
    let api: TodoistApi;
    try {
      api = await this.todoistClient.getUserApi(userId);
    } catch (error) {
      if (error instanceof OAuthError) {
        await this.replySessionInvalid(interaction, language);
        return;
      }
      throw error;
    }

    let modalData: TaskAddModalData | undefined;
    try {
      let prefill: TaskAddModalPrefill | undefined;
      let taskName = parentTaskName;

      /* For task update, fetch current task to pre-fill the modal */
      if (mode === TaskAddModalMode.Edit) {
        const task = await this.todoistClient.getTask(userId, taskId, api);
        prefill = {
          content: task.content,
          description: task.description || undefined,
          priority: task.priority,
          dueDate: TaskAddHandler.taskDueDateToSelectionOption(task),
          project: task.projectId,
        };
        taskName = task.content;
      }

      /* Show modal and await submission */
      modalData = await this.sendAndAwaitModalSubmit(
        interaction,
        api,
        language,
        prefill,
        mode,
      );

      /* Create subtask or update the recently created task */
      if (mode === TaskAddModalMode.Subtask) {
        const subtask = await this.todoistClient.addTaskBySelectedDate(
          userId,
          modalData.dueDateString,
          {
            content: modalData.content,
            description: modalData.description,
            priority: modalData.priority,
            projectId: modalData.project !== TaskAddModal.PROJECT_NONE_VALUE
              ? modalData.project
              : undefined,
            parentId: taskId,
          },
          api,
        );

        await modalData.submission.reply(this.buildSuccessResponse(
          subtask,
          language,
          componentIdBuilder,
          taskName,
        ));
      } else {
        const updatedTask = await this.todoistClient.updateTask(
          userId,
          taskId,
          {
            content: modalData.content,
            description: modalData.description,
            priority: modalData.priority,
            dueString: modalData.dueDateString,
          },
          api,
        );

        await modalData.submission.reply({
          content: this.translationHandler.translateCommon(
            language,
            "add-task.actions.edit.success",
            { task: TaskAddHandler.truncateTaskName(updatedTask.content) },
          ),
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (error) {
      if (error instanceof ModalCancelledError) {
        return; // User cancelled or modal timed out: already handled
      }

      const submission = modalData?.submission;
      const replyFn = submission
        ? (msg: string) => submission.reply({
            content: msg,
            flags: MessageFlags.Ephemeral,
          })
        : (msg: string) => interaction.reply({
            content: msg,
            flags: MessageFlags.Ephemeral,
          });

      await this.handleActionError(error, errorKey, language, replyFn);
    }
  }

  /**
   * Handles errors for task actions with consistent OAuth and generic error handling.
   */
  private async handleActionError(
    error: unknown,
    errorKey: string,
    language: Locale,
    reply: (message: string) => Promise<unknown>,
  ): Promise<void> {
    if (error instanceof OAuthError) {
      await reply(this.translationHandler.translateCommon(language, "session.invalid", {
        loginCommand: await this.client.getCommandMention("todoist login"),
      }));
      return;
    }

    if (error instanceof TaskNotFoundError) {
      await reply(this.translationHandler.translateCommon(
        language,
        "add-task.task-not-found",
      ));
      return;
    }

    const errorCode = generateErrorCode();
    displayDetailedError(`Error executing task action`, error, errorCode);
    await reply(
      this.translationHandler.translateCommon(language, errorKey, { errorCode }),
    );
  }

  /** Replies with the session invalid message for OAuth errors. */
  private async replySessionInvalid(
    interaction: Repliable,
    language: Locale,
  ): Promise<void> {
    await interaction.reply({
      content: this.translationHandler.translateCommon(language, "session.invalid", {
        loginCommand: await this.client.getCommandMention("todoist login"),
      }),
      flags: MessageFlags.Ephemeral,
    });
  }

  /** Truncates a task name to 80 characters if needed. */
  private static truncateTaskName(content: string, maxLength = 80): string {
    return content.length > maxLength
      ? content.substring(0, maxLength) + "..."
      : content;
  }

  /**
   * Converts a task's due date to the corresponding DueStringSelectionOptions value.
   * Returns undefined if the task's due date doesn't match any predefined options.
   */
  private static taskDueDateToSelectionOption(task: Task): DueStringSelectionOptions | undefined {
    if (!task.due?.date)
      return undefined;

    /* Check if the date is today */
    const taskDate = task.due.date.slice(0, 10);
    const today = new Date();
    const toDateStr = (d: Date) => d.toISOString().slice(0, 10);
    if (taskDate === toDateStr(today)) {
      return DueStringSelectionOptions.Today;
    }

    /* Check if the date is tomorrow */
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (taskDate === toDateStr(tomorrow)) {
      return DueStringSelectionOptions.Tomorrow;
    }

    /* Check if the date is another day of the week */
    const dayOfWeek = today.getDay();
    const daysUntilNextMonday = (8 - dayOfWeek) % 7 || 7;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilNextMonday);
    if (taskDate === toDateStr(nextMonday)) {
      return DueStringSelectionOptions.NextMonday;
    }

    /* Check if the date is next week */
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    if (taskDate === toDateStr(nextWeek)) {
      return DueStringSelectionOptions.NextWeek;
    }

    /* Check if the date is next month */
    const nextMonth = new Date(today);
    nextMonth.setMonth(today.getMonth() + 1);
    if (taskDate === toDateStr(nextMonth)) {
      return DueStringSelectionOptions.NextMonth;
    }

    return undefined;
  }

  /** Parses the value from the actions select menu interaction. */
  private static parseActionValue(value: string): {
    action: string;
    taskId: string;
    taskName: string;
  } | undefined {
    const parts = value.split(":");
    if (parts.length < 3) {
      return undefined;
    }

    const [action, taskId, ...taskNameParts] = parts;
    return { action, taskId, taskName: taskNameParts.join(":") };
  }

  /**
   * Fetches and caches the user's active projects from Todoist.
   * Subsequent calls are no-ops if projects were already loaded.
   *
   * @param api the authenticated Todoist API instance
   * @throws if the API call fails (caller decides how to handle)
   */
  private async loadProjects(api: TodoistApi): Promise<void> {
    if (this.projectsFetched)
      return;
    const { results } = await api.getProjects();
    this.projects = results
      .filter(project => !project.isDeleted && !project.isFrozen)
      .map(project => ({ id: project.id, name: project.name }));
    this.projectsFetched = true;
  }

  /**
   * Finds a project name by ID from the fetched project list.
   */
  private findProjectName(projectId: string): string | undefined {
    return this.projects.find(p => p.id === projectId)?.name;
  }
}
