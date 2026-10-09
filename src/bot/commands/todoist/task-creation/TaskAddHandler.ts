import type { TranslationHandler } from "@bot/handlers/TranslationHandler";
import type { Task, TodoistApi } from "@doist/todoist-api-typescript";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type { InteractionReplyOptions, Locale, ModalBuilder, ModalSubmitInteraction } from "discord.js";
import type { ProjectOption, TaskAddModalData, TaskAddModalPrefill } from "./TaskAddModal";
import { Tickly } from "@bot/Tickly";
import { OAuthError } from "@services/todoist/errors/OAuthError";
import { displayDetailedError, generateErrorCode } from "@src/utils/logger";
import {
  ComponentType,
  MessageFlags,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import { TaskAddModal } from "./TaskAddModal";

interface Repliable {
  reply: (options: InteractionReplyOptions) => Promise<unknown>;
}

interface SelectMenuInteraction {
  values: string[];
  user: { id: string };
  deferReply: (options: { flags: number }) => Promise<unknown>;
  editReply: (options: { content: string }) => Promise<unknown>;
  reply: (options: { content: string; flags: number }) => Promise<unknown>;
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
  reply: (options: { content: string; flags: number }) => Promise<unknown>;
}

/**
 * Handles the shared logic for adding a Todoist task:
 * fetching projects, showing the modal, and creating the task via the API.
 *
 * This handler is stateless per-invocation; a new instance should be created
 * for each command execution to hold the modal reference.
 */
export class TaskAddHandler {
  /** Action identifier for the select menu component. */
  public static readonly ACTIONS_COMPONENT_ID = "actions";
  /** Value prefix for the "complete task" action in the select menu. */
  public static readonly ACTION_COMPLETE = "complete";
  /** Value prefix for the "delete task" action in the select menu. */
  public static readonly ACTION_DELETE = "delete";

  private modal: TaskAddModal | undefined;
  private projects: ProjectOption[] = [];
  private projectsFetched = false;

  constructor(
    private readonly todoistClient: TodoistApiClient,
    private readonly translationHandler: TranslationHandler,
    private readonly priorityEmotes: Record<number, string>,
  ) {}

  /**
   * Fetches user projects, builds and shows the "Add Task" modal, and awaits
   * the user's submission.
   *
   * @param interaction the interaction that will receive the modal
   * @param api the authenticated Todoist API instance
   * @param language locale for modal labels
   * @param prefill optional pre-fill data for the modal fields
   * @returns the submitted modal data
   * @throws {ModalCancelledError} if the user does not submit the modal or
   *         if fetching projects fails (error reply is sent before throwing)
   */
  public async sendAndAwaitModalSubmit(
    interaction: InteractionWithModal,
    api: TodoistApi,
    language: Locale,
    prefill?: TaskAddModalPrefill,
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
   * @param componentIdBuilder function to build component customIds (from the command)
   * @returns the interaction reply options with components
   */
  public buildSuccessResponse(
    task: Task,
    language: Locale,
    componentIdBuilder: (action: string) => string,
  ): InteractionReplyOptions {
    const projectName = this.findProjectName(task.projectId);
    const dateDisplay = task.due?.date
      ? (Tickly.dateStringToDiscordTimestamp(task.due.date) ?? task.due.string)
      : this.translationHandler.translateCommon(language, "add-task.success-no-date");

    const truncatedTask = task.content.length > 80
      ? task.content.substring(0, 80) + "..."
      : task.content;

    const successText
      = this.translationHandler.translateCommon(language, "add-task.success", {
        task: truncatedTask,
        taskUrl: task.url,
        project: projectName
          || this.translationHandler.translateCommon(
            language,
            "add-task.success-no-project",
          ),
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
   *
   * @param task the Todoist task
   * @param language locale for option labels
   * @param componentIdBuilder function to build the customId
   * @returns the configured StringSelectMenuBuilder
   */
  private buildActionsSelectMenu(
    task: Task,
    language: Locale,
    componentIdBuilder: (action: string) => string,
  ): StringSelectMenuBuilder {
    const taskNameForValue = task.content.length > 50
      ? task.content.substring(0, 50) // truncate to avoid Discord limit
      : task.content;

    return new StringSelectMenuBuilder()
      .setCustomId(componentIdBuilder(TaskAddHandler.ACTIONS_COMPONENT_ID))
      .setPlaceholder(
        this.translationHandler.translateCommon(language, "add-task.actions.placeholder"),
      )
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(this.translationHandler.translateCommon(
            language,
            "add-task.actions.complete.label",
          ))
          .setValue(`${TaskAddHandler.ACTION_COMPLETE}:${task.id}:${taskNameForValue}`),
        new StringSelectMenuOptionBuilder()
          .setLabel(this.translationHandler.translateCommon(
            language,
            "add-task.actions.delete.label",
          ))
          .setValue(`${TaskAddHandler.ACTION_DELETE}:${task.id}:${taskNameForValue}`),
      );
  }

  /**
   * Handles task actions from the success message select menu.
   * This is a static method that can be called from command handlers.
   *
   * @param interaction the select menu interaction
   * @param language locale for response messages
   * @param todoistClient the Todoist API client
   * @param client the Tickly client instance
   */
  public static async handleTaskAction(
    interaction: SelectMenuInteraction,
    language: Locale,
    todoistClient: TodoistApiClient,
    client: Tickly,
  ): Promise<void> {
    const selectedValue = interaction.values[0];
    const parsed = TaskAddHandler.parseActionValue(selectedValue);
    const translationHandler = client.getTranslationHandler();

    if (!parsed) {
      await interaction.reply({
        content: translationHandler.translateCommon(language, "interactionHandling.executionError", {
          errorCode: "INVALID_ACTION",
        }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const userId = interaction.user.id;
    const { action, taskId, taskName } = parsed;

    try {
      if (action === TaskAddHandler.ACTION_COMPLETE) {
        await todoistClient.closeTask(userId, taskId);
        await interaction.editReply({
          content: translationHandler.translateCommon(language, "add-task.actions.complete.success", {
            task: taskName,
          }),
        });
      } else if (action === TaskAddHandler.ACTION_DELETE) {
        await todoistClient.deleteTask(userId, taskId);
        await interaction.editReply({
          content: translationHandler.translateCommon(language, "add-task.actions.delete.success", {
            task: taskName,
          }),
        });
      }
    } catch (error) {
      if (error instanceof OAuthError) {
        await interaction.editReply({
          content: translationHandler.translateCommon(language, "session.invalid", {
            loginCommand: await client.getCommandMention("todoist login"),
          }),
        });
        return;
      }

      const errorCode = generateErrorCode();
      displayDetailedError(`Error executing task action '${action}'`, error, errorCode);

      const errorKey = action === TaskAddHandler.ACTION_COMPLETE
        ? "add-task.actions.complete.error"
        : "add-task.actions.delete.error";

      await interaction.editReply({
        content: translationHandler.translateCommon(language, errorKey, { errorCode }),
      });
    }
  }

  /**
   * Parses the value from the actions select menu interaction.
   *
   * @param value the selected option value in format "action:taskId:taskName"
   * @returns parsed action data or undefined if format is invalid
   */
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
   * @param projectId the project ID to search for
   * @returns the project name, or undefined if not found
   */
  private findProjectName(projectId: string): string | undefined {
    return this.projects.find(p => p.id === projectId)?.name;
  }
}
