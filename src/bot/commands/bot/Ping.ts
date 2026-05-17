import type { ChatInputCommandInteraction, Locale } from "discord.js";
import { SlashCommand, SlashCommandCategory } from "../SlashCommand";

/** Shows the discord client and API response time. */
export default class Ping extends SlashCommand {
  readonly category = SlashCommandCategory.Bot;
  readonly data = {
    name: "ping",
  };

  public async execute(
    interaction: ChatInputCommandInteraction,
    language: Locale,
  ): Promise<void> {
    const message = await interaction.reply({
      content: this.translate(language, "process"),
    });
    const clientPing = message.createdTimestamp - interaction.createdTimestamp;

    await interaction.editReply({
      content: "\\🏓 Pong!\n"
        + " ㄴ Tickly » `" + clientPing + "ms`\n"
        + " ㄴ Discord Websocket » `" + this.client.ws.ping + "ms`",
    });
  }
}
