import type { Task, TodoistApi } from "@doist/todoist-api-typescript";
import type { ChatInputCommandInteraction, Locale } from "discord.js";
import type { TaskAddModalData } from "./TaskAddModal";
import { Tickly } from "@bot/Tickly";
import { displayDetailedError, generateErrorCode } from "@src/utils/logger";
import { MessageFlags } from "discord.js";
import { SubCommand } from "../SubCommand";
import { TaskAddModal } from "./TaskAddModal";

/** Slash sub-command to add a task to Todoist via a modal dialog. */
export default class TaskAdd extends SubCommand {
  readonly data = {
    name: "add",
  };

  public async execute(
    interaction: ChatInputCommandInteraction,
    language: Locale,
  ): Promise<void> {
    const userId = interaction.user.id;
    let api: TodoistApi | undefined;
    let data: TaskAddModalData | undefined;
    let projects: { id: string; name: string }[] | undefined;

    try {
      api = await this.todoistClient.getUserApi(userId);
    } catch {
      await interaction.reply({
        content: this.client.getTranslationHandler()
          .translateCommon(language, "session.invalid", {
            loginCommand: await this.client.getCommandMention("todoist login"),
          }),
        flags: MessageFlags.Ephemeral,
      });
    }

    if (api) {
      /* Fetch user's projects to populate modal select menu */
      try {
        const { results } = await api.getProjects();
        projects = results
          .filter(project => !project.isDeleted && !project.isFrozen)
          .map(project => ({ id: project.id, name: project.name }));
      } catch (error) {
        const errorCode = generateErrorCode();
        displayDetailedError("Error fetching Todoist projects", error, errorCode);
        await interaction.reply({
          content: this.client.getTranslationHandler()
            .translateCommon(language, "todoist.projects-fetch-error", {
              errorCode,
            }),
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    if (api && projects !== undefined) {
      const modal = new TaskAddModal(
        projects,
        this.client.getTranslationHandler(),
        language,
        this.client.getConfig().emotes.priorities,
      );
      await interaction.showModal(modal.build());

      try {
        data = await modal.awaitSubmit(interaction);
      } catch {
        // User did not submit the modal, nothing to do
      }

      if (data) {
        this.addToTodoist(userId, projects, data, language, api);
      }
    }
  }

  private async addToTodoist(
    userId: string,
    userProjects: { id: string; name: string }[],
    data: TaskAddModalData,
    language: Locale,
    api?: TodoistApi,
  ): Promise<void> {
    let task: Task | undefined;
    try {
      task = await this.todoistClient.addTaskBySelectedDate(
        userId,
        data.dueDateString,
        { // task arguments
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
        content: this.translate(language, "creation-error", { errorCode }),
        flags: MessageFlags.Ephemeral,
      });
    }

    if (task) { // success message
      const projectName = userProjects.find(p => p.id === task.projectId)?.name;
      const dateDisplay = task.due?.date
        ? (Tickly.dateStringToDiscordTimestamp(task.due.date) ?? task.due.string)
        : this.translate(language, "success-no-date");

      await data.submission.reply({
        content: this.translate(language, "success", {
          task: task.content.length > 80
            ? task.content.substring(0, 80) + "..."
            : task.content,
          taskUrl: task.url,
          project: projectName || this.translate(language, "success-no-project"),
          date: dateDisplay,
        }),
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}
