import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApi } from "@doist/todoist-api-typescript";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type { ChatInputCommandInteraction, Locale } from "discord.js";
import type { SlashCommandCategory } from "../../core/SlashCommand";
import { ApplicationCommandOptionType, MessageFlags } from "discord.js";
import { SubCommand } from "../../core/SubCommand";
import { ModalCancelledError, TaskAddHandler } from "./TaskAddHandler";

/** Slash sub-command to add a task to Todoist via a modal dialog. */
export default class TaskAdd extends SubCommand {
  readonly data = {
    name: "add",
    options: [{
      name: "content",
      type: ApplicationCommandOptionType.String,
      required: false,
    }],
  };

  private readonly handler: TaskAddHandler;

  constructor(
    client: Tickly,
    todoistClient: TodoistApiClient,
    repositories: RepositoryFactory,
    parentCommandName: string,
    parentCommandCategory?: SlashCommandCategory,
  ) {
    super(client, todoistClient, repositories, parentCommandName, parentCommandCategory);
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
    interaction: ChatInputCommandInteraction,
    language: Locale,
  ): Promise<void> {
    const userId = interaction.user.id;
    const content = interaction.options.getString("content");
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

      if (content) {
        await this.handler.addToTodoist(
          userId,
          content,
          language,
          componentIdBuilder,
          interaction,
          api,
        );
      } else {
        try {
          const data = await this.handler.sendAndAwaitModalSubmit(
            interaction,
            api,
            language,
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
  }
}
