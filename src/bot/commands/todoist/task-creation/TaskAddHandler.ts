import type { TranslationHandler } from "@bot/handlers/TranslationHandler";
import type { Task, TodoistApi } from "@doist/todoist-api-typescript";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type { Locale, ModalBuilder, ModalSubmitInteraction } from "discord.js";
import type { ProjectOption, TaskAddModalData, TaskAddModalPrefill } from "./TaskAddModal";
import { Tickly } from "@bot/Tickly";
import { displayDetailedError, generateErrorCode } from "@src/utils/logger";
import { MessageFlags } from "discord.js";
import { TaskAddModal } from "./TaskAddModal";

interface Repliable {
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
   * @param interaction the interaction to reply to (required when data is a string)
   * @param api optional pre-fetched TodoistApi instance
   */
  public async addToTodoist(
    userId: string,
    data: TaskAddModalData | string,
    language: Locale,
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
      const projectName = this.findProjectName(task.projectId);
      const dateDisplay = task.due?.date
        ? (Tickly.dateStringToDiscordTimestamp(task.due.date) ?? task.due.string)
        : this.translationHandler.translateCommon(language, "add-task.success-no-date");

      await repliable.reply({
        content: this.translationHandler.translateCommon(language, "add-task.success", {
          task: task.content.length > 80
            ? task.content.substring(0, 80) + "..."
            : task.content,
          taskUrl: task.url,
          project: projectName
            || this.translationHandler.translateCommon(language, "add-task.success-no-project"),
          date: dateDisplay,
        }),
        flags: MessageFlags.Ephemeral,
      });
    }
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
