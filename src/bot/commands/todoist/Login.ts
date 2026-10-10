import type { UserSession } from "@services/todoist/sessions/UserSession";
import type { ChatInputCommandInteraction, Locale } from "discord.js";
import { UserSessionStatus } from "@services/todoist/sessions/UserSession";
import { ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } from "discord.js";
import { SubCommand } from "../core/SubCommand";

export default class Login extends SubCommand {
  readonly data = {
    name: "login",
  };

  public async execute(
    interaction: ChatInputCommandInteraction,
    language: Locale,
  ): Promise<void> {
    let alreadyReplied = false;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    /* Check if user already has a session */
    const session
      = await this.todoistClient.getSessionByUserId(interaction.user.id);

    if (session?.status === UserSessionStatus.Completed && session.accessToken) {
      await interaction.editReply({
        content: this.translate(language, "alreadyLoggedIn", {
          helpCommand: await this.client.getCommandMention("help"),
        }),
      });
    } else { // create or update session with a new OAuth2 URL
      /* Warn user for session overwrite if they have one pending */
      if (this.isSessionPending(session)) {
        alreadyReplied = true;
        await interaction.editReply({
          content: this.translate(language, "existingPendingSession"),
        });
      }

      const authorizationUrl = await this.todoistClient
        .createOAuthAuthorizationUrl(interaction.user.id, language);

      const message = {
        content: this.translate(language, "instructions"),
        components: [{
          type: ComponentType.ActionRow,
          components: [this.getLoginButton(authorizationUrl, language)],
        }],
      };
      if (alreadyReplied) {
        await interaction.followUp({
          ...message,
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.editReply(message);
      }
    }
  }

  private isSessionPending(session?: UserSession): boolean {
    return !!(
      session?.status === UserSessionStatus.Pending
      && session.expiresAt
      && session.expiresAt > new Date()
    );
  }

  private getLoginButton(authorizationUrl: string, language: Locale): ButtonBuilder {
    return new ButtonBuilder()
      .setLabel(this.translate(language, "link"))
      .setStyle(ButtonStyle.Link)
      .setURL(authorizationUrl);
  }
}
