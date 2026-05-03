import type { ChatInputCommandInteraction, Locale } from "discord.js";
import { SubCommand } from "../SubCommand";

export default class Login extends SubCommand {
  readonly data = {
    name: "login",
  };

  public async execute(
    interaction: ChatInputCommandInteraction,
    language: Locale,
  ): Promise<void> {
    interaction.reply("TODO");
  }
}
