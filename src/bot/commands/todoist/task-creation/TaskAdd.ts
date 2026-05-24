import type { TodoistApi } from "@doist/todoist-api-typescript";
import type { ChatInputCommandInteraction, Locale } from "discord.js";
import { MessageFlags } from "discord.js";
import { SubCommand } from "../../core/SubCommand";
import { ModalCancelledError, TaskAddHandler } from "./TaskAddHandler";

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
      const handler = new TaskAddHandler(
        this.todoistClient,
        this.client.getTranslationHandler(),
        this.client.getConfig().emotes.priorities,
      );

      try {
        const data = await handler.sendAndAwaitModalSubmit(
          interaction,
          api,
          language,
        );
        handler.addToTodoist(userId, data, language, api);
      } catch (error) {
        if (!(error instanceof ModalCancelledError)) {
          throw error;
        } // else silently ignore modal cancellation
      }
    }
  }
}
