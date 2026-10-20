import type { TranslationHandler } from "@bot/handlers/TranslationHandler";
import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { Locale, MessageCreateOptions } from "discord.js";
import { DmDisabledError, UserNotFoundError } from "@bot/services/NotificationErrors";
import { DiscordAPIError, RESTJSONErrorCodes } from "discord.js";

/**
 * Centralises Discord DM delivery with typed error propagation.
 *
 * Callers are responsible for handling {@link DmDisabledError},
 * {@link UserNotFoundError}, and any other errors thrown by the methods.
 */
export class NotificationService {
  constructor(
    private readonly client: Tickly,
    private readonly translationHandler: TranslationHandler,
    private readonly repositories: RepositoryFactory,
  ) {}

  /**
   * Sends a pre-built message as a DM to a Discord user.
   *
   * @param userId the Discord user ID of the recipient
   * @param payload the message payload to send
   * @returns the sent message ID
   * @throws {DmDisabledError} if the user has DMs disabled
   * @throws {UserNotFoundError} if the user does not exist
   * @throws {Error} for other Discord API errors
   */
  public async sendDM(userId: string, payload: MessageCreateOptions): Promise<string> {
    try {
      const user = await this.client.users.fetch(userId);
      const channel = await user.createDM();
      const message = await channel.send(payload);
      return message.id;
    } catch (error: unknown) {
      if (error instanceof DiscordAPIError
        && error.code === RESTJSONErrorCodes.CannotSendMessagesToThisUser) {
        throw new DmDisabledError(userId);
      } else if (error instanceof DiscordAPIError
        && error.code === RESTJSONErrorCodes.UnknownUser) {
        throw new UserNotFoundError(userId);
      }
      throw error;
    }
  }

  /**
   * Sends a login success DM to a Discord user after Todoist OAuth completes.
   *
   * @param userId the Discord user ID of the recipient
   * @param locale the locale used to resolve the notification text
   * @returns the sent message ID
   * @throws {DmDisabledError} if the user has DMs disabled
   * @throws {UserNotFoundError} if the user does not exist
   * @throws {Error} for other Discord API errors
   */
  public async notifyLoginSuccess(userId: string, locale: Locale): Promise<string> {
    let content = this.t(locale, "login.success");
    const retentionDays = await this.repositories
      .getUserRepository()
      .getUserSessionRetentionDays(userId);

    if (retentionDays === null) {
      content += `\n${this.t(locale, "login.session_retention_hint", {
        days: String(this.client.getConfig().defaultSessionRetentionDays),
        settings: await this.client.getCommandMention("settings"),
      })}`;
    }

    return this.sendDM(userId, { content });
  }

  private t(locale: Locale, key: string, params?: Record<string, string>): string {
    return this.translationHandler.translateNotification(locale, key, params);
  }
}
