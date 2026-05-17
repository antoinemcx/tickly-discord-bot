import type { ChatInputCommandInteraction, Locale } from "discord.js";
import { UserSessionStatus } from "@services/todoist/sessions/UserSession";
import { MessageFlags } from "discord.js";
import { SubCommand } from "../SubCommand";

export default class Logout extends SubCommand {
  readonly data = {
    name: "logout",
  };

  public async execute(
    interaction: ChatInputCommandInteraction,
    language: Locale,
  ): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const session
      = await this.todoistClient.getSessionByUserId(interaction.user.id);

    if (session?.status === UserSessionStatus.Completed) {
      try {
        await this.todoistClient.clearUserSession(interaction.user.id);
        await interaction.editReply({
          content: this.translate(language, "logoutSuccess"),
        });
      } catch {
        await interaction.editReply({
          content: this.translate(language, "logoutError"),
        });
      }
    } else {
      await interaction.editReply({
        content: this.translate(language, "noSession", {
          loginCommand: await this.client.getCommandMention("todoist login"),
        }),
      });
    }
  }
}
