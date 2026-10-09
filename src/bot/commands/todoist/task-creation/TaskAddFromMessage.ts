import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApi } from "@doist/todoist-api-typescript";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type { Locale, MessageContextMenuCommandInteraction } from "discord.js";
import type { TaskAddModalPrefill } from "./TaskAddModal";
import { MessageFlags } from "discord.js";
import { MessageCommand } from "../../core/MessageCommand";
import { ModalCancelledError, TaskAddHandler } from "./TaskAddHandler";

/** Message command to add a task to Todoist via a modal dialog. */
export default class TaskAddFromMessage extends MessageCommand {
  readonly translationName = "add-from-message";
  readonly data = {};

  private readonly handler: TaskAddHandler;

  constructor(
    client: Tickly,
    todoistClient: TodoistApiClient,
    repositories: RepositoryFactory,
  ) {
    super(client, todoistClient, repositories);
    this.handler = new TaskAddHandler(todoistClient, client);

    this.onMessageComponent(
      TaskAddHandler.ACTIONS_COMPONENT_ID,
      async (interaction, language) => {
        if (interaction.isStringSelectMenu()) {
          const componentIdBuilder = (action: string) => this.buildComponentId(action);
          await this.handler.handleTaskAction(
            interaction,
            language,
            componentIdBuilder,
          );
        }
      },
    );
  }

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
      const componentIdBuilder = (action: string) => this.buildComponentId(action);

      try {
        const prefill = this.buildPrefill(interaction);
        const data = await this.handler.sendAndAwaitModalSubmit(
          interaction,
          api,
          language,
          prefill,
        );
        await this.handler.addToTodoist(
          userId,
          data,
          language,
          componentIdBuilder,
          undefined,
          api,
        );
      } catch (error) {
        if (!(error instanceof ModalCancelledError)) {
          throw error;
        } // else silently ignore modal cancellation
      }
    }
  }

  /** Extracts pre-fill data from the target message for the modal. */
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
