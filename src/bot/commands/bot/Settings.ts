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

/**
 * Displays current user preferences and allows modifications.
 * Updatable preferences: bot language, session duration.
 */
export default class Settings extends SlashCommand {
  readonly category = SlashCommandCategory.Bot;
  readonly data = {
    name: "settings",
  };

  private static readonly SET_LANGUAGE_ACTION = "set_language";
  private static readonly DEFAULT_LOCALE_VALUE = "default";

  // TODO this setting won't be updatable with reminder systems
  private static readonly SET_RETENTION_ACTION = "set_retention";
  private static readonly DEFAULT_RETENTION_VALUE = "default";

  /** Available session retention options */
  private static readonly RETENTION_OPTIONS: ReadonlyArray<{
    value: string;
    days: number | null;
  }> = [
    { value: "default", days: null },
    { value: "7", days: 7 },
    { value: "14", days: 14 },
    { value: "30", days: 30 },
    { value: "90", days: 90 },
    { value: "180", days: 180 },
  ];

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

    this.onMessageComponent(
      Settings.SET_RETENTION_ACTION,
      async (interaction, language) => {
        if (interaction.isStringSelectMenu()) {
          await this.updateSessionRetention(
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
      const preferences = await this.repositories.getUserRepository()
        .getUserPreferences(interaction.user.id);

      const preferredLocale: Locale | undefined
        = preferences.language?.code
          && this.client.getTranslationHandler()
            .isSupportedLocale(preferences.language.code)
          ? preferences.language.code
          : undefined;

      await this.displaySettings(
        interaction,
        language,
        preferredLocale,
        preferences.sessionRetentionDays,
      );
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
    retentionDays: number | null,
  ): Promise<void> {
    const languageSelect = this.buildLanguageSelect(language, preferredLocale);
    const retentionSelect = this.buildRetentionSelect(language, retentionDays);

    const container = new ContainerBuilder()
      .setAccentColor(BaseCommand.EMBED_COLOR)
      .addTextDisplayComponents(textDisplay => textDisplay.setContent(
        this.translate(language, "view.generalSettings")
        + "\n" + this.translate(language, "view.language"),
      ))
      .addActionRowComponents(actionRow =>
        actionRow.addComponents(languageSelect))
      .addTextDisplayComponents(textDisplay => textDisplay.setContent(
        this.translate(language, "view.sessionDuration"),
      ))
      .addActionRowComponents(actionRow =>
        actionRow.addComponents(retentionSelect));

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

  private buildRetentionSelect(
    language: Locale,
    currentRetentionDays: number | null,
  ): StringSelectMenuBuilder {
    const defaultDays = String(this.client.getConfig().defaultSessionRetentionDays);

    return new StringSelectMenuBuilder()
      .setCustomId(this.buildComponentId(Settings.SET_RETENTION_ACTION))
      .addOptions(
        Settings.RETENTION_OPTIONS.map(({ value, days }) => {
          const isDefault = value === Settings.DEFAULT_RETENTION_VALUE;
          const labelKey = isDefault
            ? "sessionDurationOptions.default"
            : `sessionDurationOptions.${days}days`;
          const option = new StringSelectMenuOptionBuilder()
            .setLabel(this.translate(
              language,
              labelKey,
              isDefault ? { days: defaultDays } : {},
            ))
            .setValue(value)
            .setDefault(currentRetentionDays === days);

          if (isDefault) {
            option.setDescription(
              this.translate(
                language,
                "sessionDurationOptions.defaultDescription",
                { days: defaultDays },
              ),
            );
          }
          return option;
        }),
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
   * Updates the user's session retention preference and sends a confirmation.
   *
   * @param interaction the interaction from the retention select menu
   * @param language the current response language
   */
  private async updateSessionRetention(
    interaction: StringSelectMenuInteraction,
    language: Locale,
  ): Promise<void> {
    const selectedValue = interaction.values[0];
    const isDefault = selectedValue === Settings.DEFAULT_RETENTION_VALUE;
    const days = isDefault ? null : Number(selectedValue);
    const defaultDays = String(this.client.getConfig().defaultSessionRetentionDays);
    let hasChanges = false;

    try {
      await this.repositories.getUserRepository()
        .setUserSessionRetentionDays(interaction.user.id, days);
      hasChanges = true;
    } catch (error) {
      displayDetailedError(
        `Failed to update session retention for user ${interaction.user.id}`,
        error,
      );
    }

    if (hasChanges) {
      await this.interactionReplyOrFollow(interaction, {
        content: isDefault
          ? this.translate(language, "update.sessionRetention.cleared", { days: defaultDays })
          : this.translate(language, "update.sessionRetention.success", {
              duration: this.translate(language, `sessionDurationOptions.${days}days`),
            }),
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
