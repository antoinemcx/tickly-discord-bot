import type { TranslationHandler } from "@bot/handlers/TranslationHandler";
import type { Task, TodoistApi } from "@doist/todoist-api-typescript";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type { Locale, ModalBuilder, ModalSubmitInteraction } from "discord.js";
import type { ProjectOption, TaskAddModalData, TaskAddModalPrefill } from "./TaskAddModal";
import { Tickly } from "@bot/Tickly";
import { displayDetailedError, generateErrorCode } from "@src/utils/logger";
import { MessageFlags } from "discord.js";
import { TaskAddModal } from "./TaskAddModal";

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
    this.projects = await this.fetchProjects(interaction, api, language);

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
   * Creates a Todoist task from the submitted modal data and replies to the
   * user with a success or error message.
   *
   * @param userId the Discord user ID
   * @param data the submitted modal data
   * @param language locale for reply messages
   * @param api optional pre-fetched TodoistApi instance
   */
  public async addToTodoist(
    userId: string,
    data: TaskAddModalData,
    language: Locale,
    api?: TodoistApi,
  ): Promise<void> {
    let task: Task | undefined;
    try {
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
    } catch (error) {
      const errorCode = generateErrorCode();
      displayDetailedError("Error creating Todoist task", error, errorCode);
      await data.submission.reply({
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

      await data.submission.reply({
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
   * Fetches the user's active projects from Todoist.
   * If the API call fails, replies to the interaction with an error message
   * and throws {@link ModalCancelledError} to terminate the flow.
   *
   * @param interaction the interaction to reply to on error
   * @param api the authenticated Todoist API instance
   * @param language locale for error messages
   * @returns the filtered list of active projects
   * @throws {ModalCancelledError} if the API call fails
   */
  private async fetchProjects(
    interaction: InteractionWithModal,
    api: TodoistApi,
    language: Locale,
  ): Promise<ProjectOption[]> {
    try {
      const { results } = await api.getProjects();
      return results
        .filter(project => !project.isDeleted && !project.isFrozen)
        .map(project => ({ id: project.id, name: project.name }));
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
