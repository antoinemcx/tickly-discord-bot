import type { TodoistApi } from "@doist/todoist-api-typescript";
import type { ChatInputCommandInteraction, Locale } from "discord.js";
import type { TaskAddModalData } from "./TaskAddModal";
import { MessageFlags } from "discord.js";
import { SubCommand } from "../SubCommand";
import { TaskAddModal } from "./TaskAddModal";

// TODO i18n for TaskAddModal
// TODO tests TaskAddModal
// TODO handle errors for fetching projects
// TODO call todoist API for creation and handle errors
// TODO Todoist flag emojis for priority select menu
// TODO due date parsing (natural language? separate date/datetime fields?)

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
      const { results } = await api.getProjects();
      const projects = results.map(p => ({ id: p.id, name: p.name }));

      const modal = new TaskAddModal(projects);
      await interaction.showModal(modal.build());

      try {
        data = await modal.awaitSubmit(interaction);
      } catch {
        // Timeout — user did not submit the modal, nothing to do
      }
    }

    if (data) {
    //   const task = await this.todoistClient.addTaskForUser(userId, {
    //     data.content,
    //     data.description,
    //     data.priority,
    //     projectId: data.project,
    //     data.dueString, // TODO dueString, dueLang, dueDate, dueDatetime ?
    //   });

      await data.submission.reply({
        content: this.translate(language, "success", {
          task: data.content.length > 25
            ? data.content.substring(0, 24) + "..."
            : data.content,
        }),
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}
