import type { ChatInputCommandInteraction, Locale } from "discord.js";
import { ApplicationIntegrationType } from "discord.js";
import { SlashCommand } from "../SlashCommand";

/** Shows the discord client and API response time. */
export default class Ping extends SlashCommand {
  protected readonly data = {
    name: "ping",
    description: "🏓 Displays the bot response time.",
    description_localizations: {
      fr: "🏓 Affiche le temps de réponse du bot.",
    },
    integration_types: [
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall,
    ],
  };

  public async execute(
    interaction: ChatInputCommandInteraction,
    language: Locale,
  ): Promise<void> {
    const message = await interaction.reply({
      content: this.translate(language, "PROCESS"),
    });

    await interaction.editReply({
      content: "\\🏓 Pong!\n\n"
        + "**" + this.client.user!.username + "** » `"
        + (message.createdTimestamp - interaction.createdTimestamp)
        + "ms`\n**Gateway API** » `" + this.client.ws.ping + "ms`",
    });
  }
}
