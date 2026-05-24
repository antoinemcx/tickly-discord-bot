import type { TodoistApi } from "@doist/todoist-api-typescript";
import type { Locale, MessageContextMenuCommandInteraction } from "discord.js";
import type { TaskAddModalPrefill } from "./TaskAddModal";
import { MessageFlags } from "discord.js";
import { MessageCommand } from "../../MessageCommand";
import { ModalCancelledError, TaskAddHandler } from "./TaskAddHandler";

/** Message command to add a task to Todoist via a modal dialog. */
export default class TaskAddFromMessage extends MessageCommand {
  readonly translationName = "add-from-message";
  readonly data = {};

  public async execute(
    interaction: MessageContextMenuCommandInteraction,
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
        const prefill = this.buildPrefill(interaction);
        const data = await handler.sendAndAwaitModalSubmit(
          interaction,
          api,
          language,
          prefill,
        );
        handler.addToTodoist(userId, data, language, api);
      } catch (error) {
        if (!(error instanceof ModalCancelledError)) {
          throw error;
        } // else silently ignore modal cancellation
      }
    }
  }

  /**
   * Extracts pre-fill data from the target message for the modal.
   * @param interaction the message context menu interaction
   * @returns prefill data with content and optional description
   */
  private buildPrefill(
    interaction: MessageContextMenuCommandInteraction,
  ): TaskAddModalPrefill {
    const targetMessageLines = interaction.targetMessage.content.split("\n");
    const firstLine = targetMessageLines[0].trimStart();
    const otherLines = targetMessageLines.slice(1).join("\n");

    return {
      content: firstLine.length > 100
        ? (firstLine.substring(0, 100) + "...")
        : firstLine,
      description: firstLine.length > 100
        ? ("..." + firstLine.substring(100) + "\n" + otherLines).trim()
        : (otherLines ? otherLines.trim() : undefined),
    };
  }
}
