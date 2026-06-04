import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type {
  ChatInputCommandInteraction,
  InteractionReplyOptions,
  Locale,
  StringSelectMenuInteraction,
} from "discord.js";
import { displayDetailedError } from "@src/utils/logger";
import {
  ContainerBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import { BaseCommand } from "../core/BaseCommand";
import { SlashCommand, SlashCommandCategory } from "../core/SlashCommand";

// TODO update user preferred language in database
// TODO unit tests

/**
 * Displays current user preferences and allows modifications.
 * Currently, updatable preferences only include the bot language.
 */
export default class Settings extends SlashCommand {
  readonly category = SlashCommandCategory.Bot;
  readonly data = {
    name: "settings",
  };

  private static readonly SET_LANGUAGE_ACTION = "set_language";
  private static readonly DEFAULT_LOCALE_VALUE = "default";

  constructor(
    client: Tickly,
    todoistClient: TodoistApiClient,
    repositories: RepositoryFactory,
  ) {
    super(client, todoistClient, repositories);

    this.onMessageComponent(
      Settings.SET_LANGUAGE_ACTION,
      async (interaction, language) => {
        if (interaction.isStringSelectMenu()) {
          await this.updatePreferredLanguage(
            interaction as StringSelectMenuInteraction,
            language,
          );
        }
      },
    );
  }

  public async execute(
    interaction: ChatInputCommandInteraction,
    language: Locale,
  ): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      /* Gather current settings */
      const preferredLanguage = await this.repositories.getUserRepository()
        .getUserPreferredLanguage(interaction.user.id);
      const preferredLocale: Locale | undefined
        = preferredLanguage?.code
          && this.client.getTranslationHandler()
            .isSupportedLocale(preferredLanguage.code)
          ? preferredLanguage.code
          : undefined;

      await this.displaySettings(interaction, language, preferredLocale);
    } catch (error) {
      displayDetailedError(
        `Failed to retrieve user settings for user ${interaction.user.id}`,
        error,
      );
      await interaction.editReply({
        content: this.translate(language, "fetchError"),
      });
    }
  }

  /** Displays the current user settings with update components. */
  private async displaySettings(
    interaction: ChatInputCommandInteraction,
    language: Locale,
    preferredLocale: Locale | undefined,
  ): Promise<void> {
    const languageSelect = this.buildLanguageSelect(language, preferredLocale);

    const container = new ContainerBuilder()
      .setAccentColor(BaseCommand.EMBED_COLOR)
      .addTextDisplayComponents(textDisplay => textDisplay.setContent(
        this.translate(language, "view.generalSettings")
        + "\n" + this.translate(language, "view.language"),
      ))
      .addActionRowComponents(actionRow =>
        actionRow.addComponents(languageSelect));

    await interaction.editReply({
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      components: [container],
    });
  }

  private buildLanguageSelect(
    language: Locale,
    preferredLocale: Locale | undefined,
  ): StringSelectMenuBuilder {
    const translationHandler = this.client.getTranslationHandler();
    const supportedLocales = translationHandler.getLocales();
    const emojis = this.client.getConfig().emotes.languages;

    return new StringSelectMenuBuilder()
      .setCustomId(this.buildComponentId(Settings.SET_LANGUAGE_ACTION))
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(this.translate(language, "view.defaultLanguage"))
          .setDescription(this.translate(language, "view.defaultLanguageDescription"))
          .setValue(Settings.DEFAULT_LOCALE_VALUE)
          .setDefault(preferredLocale === undefined),
        ...supportedLocales.map(locale =>
          new StringSelectMenuOptionBuilder()
            .setLabel(translationHandler.translateCommon(locale, `languageName`))
            .setValue(locale)
            .setDefault(preferredLocale === locale)
            .setEmoji(emojis[locale as keyof typeof emojis] ?? undefined)),
      );
  }

  /**
   * Updates the user's preferred language and sends a confirmation
   * follow-up message.
   *
   * @param interaction the interaction from the language select menu
   * @param previousLanguage the previous preferred language, used for errors
   */
  private async updatePreferredLanguage(
    interaction: StringSelectMenuInteraction,
    previousLanguage: Locale,
  ): Promise<void> {
    const selectedValue = interaction.values[0];
    let newLocale: Locale | undefined;
    let hasChanges = false;

    try {
      if (selectedValue === Settings.DEFAULT_LOCALE_VALUE) {
        await this.repositories.getUserRepository()
          .setUserPreferredLanguage(interaction.user.id, null);
        hasChanges = true;
      } else {
        newLocale = selectedValue as Locale;
        await this.repositories.getUserRepository()
          .setUserPreferredLanguage(interaction.user.id, newLocale);
        hasChanges = true;
      }
    } catch (error) {
      displayDetailedError(
        `Failed to update preferred language for user ${interaction.user.id}`,
        error,
      );
    }

    if (hasChanges) {
      const translationHandler = this.client.getTranslationHandler();
      await this.interactionReplyOrFollow(interaction, {
        content: newLocale
          ? this.translate(
              newLocale,
              "update.preferredLanguage.success",
              { language: translationHandler.translateCommon(newLocale, "languageName") },
            )
          : this.translate(
              previousLanguage,
              "update.preferredLanguage.cleared",
            ),
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  /**
   * Replies to the interaction if possible, or follows up if not.
   *
   * @param interaction the interaction to reply to
   * @param response the response to send to the user
   * @returns a promise that resolves when the response has been sent
   */
  private async interactionReplyOrFollow(
    interaction: StringSelectMenuInteraction,
    response: InteractionReplyOptions,
  ): Promise<void> {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        ...response,
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.followUp({
        ...response,
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}
