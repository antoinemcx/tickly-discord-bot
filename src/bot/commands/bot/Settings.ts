import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
  InteractionReplyOptions,
  Locale,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from "discord.js";
import { displayDetailedError } from "@src/utils/logger";
import {
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
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

  private static readonly DELETE_DATA_ACTION = "delete_data";
  private static readonly DELETE_MODAL_CUSTOM_ID = "settings:delete_data_modal";
  private static readonly DELETE_MODAL_CONFIRM_FIELD = "confirm_deletion";
  private static readonly DELETE_MODAL_TIMEOUT_MS = 5 * 60_000;

  /** GDPR Article 17 links by locale */
  private static readonly GDPR_LINKS: Partial<Record<Locale, string>> = {
    "fr": "https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre3#Article17",
    "de": "https://gdprinfo.eu/de/de-article-17",
    "en-US": "https://gdprinfo.eu/en-article-17",
    "es-ES": "https://gdprinfo.eu/es/es-article-17",
    "pl": "https://gdprinfo.eu/pl/pl-article-17",
  };

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

    this.onMessageComponent(
      Settings.DELETE_DATA_ACTION,
      async (interaction, language) => {
        if (interaction.isButton()) {
          await this.showDeleteConfirmationModal(
            interaction as ButtonInteraction,
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
    const gdprLink = Settings.GDPR_LINKS[language] ?? Settings.GDPR_LINKS["en-US"]!;

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
        actionRow.addComponents(retentionSelect))
      .addSeparatorComponents(separator => separator.setDivider(true))
      .addSectionComponents(section => section
        .addTextDisplayComponents(textDisplay => textDisplay.setContent(
          this.translate(language, "deletion.infoText", { gdprLink }),
        ))
        .setButtonAccessory(new ButtonBuilder()
          .setCustomId(this.buildComponentId(Settings.DELETE_DATA_ACTION))
          .setLabel(this.translate(language, "deletion.button"))
          .setStyle(ButtonStyle.Danger)));

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

  /**
   * Shows the data deletion confirmation modal.
   *
   * @param interaction the button interaction that triggered the modal
   * @param language the current response language
   */
  private async showDeleteConfirmationModal(
    interaction: ButtonInteraction,
    language: Locale,
  ): Promise<void> {
    const confirmWord = this.translate(language, "deletion.modal.confirmWord");

    const confirmInput = new TextInputBuilder()
      .setCustomId(Settings.DELETE_MODAL_CONFIRM_FIELD)
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(20)
      .setPlaceholder(this.translate(
        language,
        "deletion.modal.confirmInput.placeholder",
        { confirmWord },
      ));
    const confirmLabel = new LabelBuilder()
      .setLabel(this.translate(language, "deletion.modal.confirmInput.label"))
      .setTextInputComponent(confirmInput);

    const modal = new ModalBuilder()
      .setCustomId(Settings.DELETE_MODAL_CUSTOM_ID)
      .setTitle(this.translate(language, "deletion.modal.title"))
      .addLabelComponents(confirmLabel);

    await interaction.showModal(modal);

    try {
      const submission = await interaction.awaitModalSubmit({
        time: Settings.DELETE_MODAL_TIMEOUT_MS,
        filter: i =>
          i.customId === Settings.DELETE_MODAL_CUSTOM_ID
          && i.user.id === interaction.user.id,
      });

      await this.handleDeleteModalSubmit(submission, language, confirmWord);
    } catch {
      // Modal timed out or was dismissed: no action needed
    }
  }

  /**
   * Handles the submission of the deletion confirmation modal.
   *
   * @param interaction the modal submit interaction
   * @param language the current response language
   * @param confirmWord the word the user must type to confirm
   */
  private async handleDeleteModalSubmit(
    interaction: ModalSubmitInteraction,
    language: Locale,
    confirmWord: string,
  ): Promise<void> {
    const inputValue
      = interaction.fields.getTextInputValue(Settings.DELETE_MODAL_CONFIRM_FIELD);

    /* Assert confirmation text */
    if (inputValue.toUpperCase() !== confirmWord.toUpperCase()) {
      await interaction.reply({
        content: this.translate(language, "deletion.invalidConfirmation", {
          confirmWord,
        }),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    /* Delete user data */
    try {
      await this.repositories.getUserRepository()
        .deleteAllUserData(interaction.user.id, this.repositories);
      await interaction.editReply({
        content: this.translate(language, "deletion.success"),
      });
    } catch (error) {
      displayDetailedError(
        `Failed to delete user data for user ${interaction.user.id}`,
        error,
      );
      await interaction.editReply({
        content: this.translate(language, "deletion.error", {
          supportServer: this.client.getConfig().links.supportServer,
        }),
      });
    }
  }
}
