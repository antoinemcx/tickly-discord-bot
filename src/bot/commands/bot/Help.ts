import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type {
  ChatInputCommandInteraction,
  InteractionEditReplyOptions,
  InteractionReplyOptions,
  Locale,
  MessageComponentInteraction,
  PermissionResolvable,
} from "discord.js";
import type { SubCommand } from "../core/SubCommand";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Tickly } from "@bot/Tickly";
import {
  ApplicationCommandOptionType,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  SeparatorSpacingSize,
} from "discord.js";
import { BaseCommand } from "../core/BaseCommand";
import { SlashCommand, SlashCommandCategory } from "../core/SlashCommand";

/** Shows help information for the bot commands. */
export default class Help extends SlashCommand {
  readonly category = SlashCommandCategory.Bot;
  readonly data = {
    name: "help",
    options: [{
      name: "command",
      type: ApplicationCommandOptionType.String,
      required: false,
    }, {
      name: "ephemeral",
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    }],
  };

  private static readonly START_GUIDE_ACTION = "start_guide";
  private static readonly BACK_TO_COMMANDS_ACTION = "back_to_commands";

  private static readonly ASSETS_FOLDER = join(__dirname, "..", "..", "assets");
  private static readonly TODOIST_LINK = "https://www.todoist.com";

  constructor(
    client: Tickly,
    todoistClient: TodoistApiClient,
    repositories: RepositoryFactory,
  ) {
    super(client, todoistClient, repositories);

    this.onMessageComponent(Help.START_GUIDE_ACTION, async (interaction, language) => {
      await this.interactionEditOrReply(
        interaction,
        await this.getStartingGuideResponse(language),
      );
    });
    this.onMessageComponent(Help.BACK_TO_COMMANDS_ACTION, async (interaction, language) => {
      await this.interactionEditOrReply(
        interaction,
        await this.getCommandListResponse(language, interaction.user.id),
      );
    });
  }

  public async execute(
    interaction: ChatInputCommandInteraction,
    language: Locale,
  ): Promise<void> {
    const commandName = interaction.options.getString("command");
    const isEphemeral = interaction.options.getBoolean("ephemeral");

    await interaction.deferReply({
      flags: isEphemeral ? MessageFlags.Ephemeral : undefined,
    });

    if (commandName) {
      await this.replyWithCommandHelp(interaction, language, commandName);
    } else {
      interaction.editReply(
        await this.getCommandListResponse(language, interaction.user.id),
      );
    }
  }

  /**
   * Edits the interaction initial response if possible.
   * An ephemeral interaction can for example not be edited, so we must
   * reply instead in that case.
   *
   * @param interaction the interaction to reply or edit the response to
   * @param response the response to send to the user
   * @returns a promise that resolves when the response has been sent
   */
  private async interactionEditOrReply(
    interaction: MessageComponentInteraction,
    response: InteractionEditReplyOptions,
  ): Promise<void> {
    const isEphemeral = interaction.message.flags.has(MessageFlags.Ephemeral);

    if (isEphemeral && !interaction.replied && !interaction.deferred) {
      await interaction.reply({
        ...response as unknown as InteractionReplyOptions,
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    } else if (isEphemeral) {
      await interaction.editReply({
        ...response,
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    } else {
      await interaction.message.edit(response);
    }
  }

  /** Replies with help information for a specific command and handles error messages. */
  private async replyWithCommandHelp(
    interaction: ChatInputCommandInteraction,
    language: Locale,
    commandName: string,
  ): Promise<void> {
    const commandPath = commandName.trim().split(" ").filter(Boolean);
    let command: SlashCommand | SubCommand | undefined
      = this.client.getSlashCommandByName(commandPath[0]);

    if (command && commandPath.length > 1) {
      /* Retrieve subcommand if more than one word in the path */
      const subCommandName = commandPath[1];
      command = command
        .getSubCommands()
        .find(sub => sub.getName() === subCommandName);
    } else if (!command) { // base command not found
      interaction.editReply({
        content: this.translate(language, "errors.unknownCommand", {
          command: this.getShortenedCommandName(commandName),
        }),
      });
      return;
    }

    if (command?.isAdminOnly // check if user admin for admin only command
      && !this.client.getConfig().ownerIds.includes(interaction.user.id)) {
      interaction.editReply({
        content: this.translate(language, "errors.adminOnlyCommand", {
          command: command.getName(),
        }),
      });
    } else if (command) {
      interaction.editReply(this.getCommandDetailsResponse(language, command));
    } else { // subcommand not found
      interaction.editReply({
        content: this.translate(language, "errors.unknownSubcommand", {
          command: this.getShortenedCommandName(commandPath[0]),
          subcommand: this.getShortenedCommandName(commandPath[1]),
        }),
      });
    }
  }

  /** Retrieves the response for the command list. */
  public async getCommandListResponse(
    language: Locale,
    userId: string,
  ): Promise<InteractionEditReplyOptions> {
    const categoryList = await this.buildCategoryListText(language, userId);

    const introText = this.translate(language, "commandList.intro.title")
      + "\n" + this.translate(language, "botDescription", {
      githubLink: this.client.getConfig().links.github,
      todoistLink: Help.TODOIST_LINK,
    })
    + "\n" + this.translate(language, "commandList.intro.features");
    const commandsText = this.translate(language, "commandList.commands.title")
      + "\n" + categoryList
      + "\n\n" + this.translate(language, "commandList.commands.tip");

    const linkButtons = this.getLinkButtons(language);
    const startGuideButton = new ButtonBuilder()
      .setCustomId(this.buildComponentId(Help.START_GUIDE_ACTION))
      .setLabel(this.translate(language, "buttons.guide"))
      .setStyle(ButtonStyle.Primary);

    return {
      flags: MessageFlags.IsComponentsV2,
      components: [this.getBaseContainer()
        .addTextDisplayComponents(textDisplay => textDisplay.setContent(introText))
        .addSeparatorComponents(this.getBaseSeparator())
        .addTextDisplayComponents(textDisplay =>
          textDisplay.setContent(commandsText))
        .addSeparatorComponents(this.getBaseSeparator())
        .addActionRowComponents(actionRow => actionRow.addComponents(linkButtons))
        .addSectionComponents(section =>
          section.addTextDisplayComponents(textDisplay =>
            textDisplay.setContent(
              this.translate(language, "commandList.startGuidePrompt"),
            ))
            .setButtonAccessory(startGuideButton))],
    };
  }

  /**
   * Builds the text for the list of command categories
   * used in the command list message.
   * @param language the language to use for translating category names
   * @param userId the ID of the user to filter admin-only commands
   * @return the category titles and their commands, or "-" if no available
   */
  private async buildCategoryListText(language: Locale, userId: string): Promise<string> {
    const commandNamesByCategories = this.getCommandNamesByCategories(userId);
    if (commandNamesByCategories.size === 0) {
      return "-";
    }

    const sections = await Promise.all(
      Array.from(commandNamesByCategories.entries()) // for all categories
        .map(async ([category, commandNames]) => {
          /* Get all command mentions for better UX when listing commands */
          const mentions = await Promise.all(commandNames.map(
            name => this.client.getCommandMention(name),
          ));
          /* Display title and list of commands */
          return `### ${this.translateCategoryKey(language, category)} (${commandNames.length})\n`
            + mentions.join(", ");
        }),
    );
    return sections.join("\n");
  }

  /**
   * Returns a map of command names by their categories, filtered based on
   * the user's permissions for admin-only commands.
   * @param userId ID of the user for whom to filter admin-only commands
   * @return category names as keys (or undefined for uncategorized)
   *   and command names as values
   */
  private getCommandNamesByCategories(userId: string): Map<string | undefined, string[]> {
    const commands = Array.from(this.client.getSlashCommands().values());
    const commandNamesByCategories = new Map<string | undefined, string[]>();

    for (const cmd of commands) {
      const category = cmd.getCategory();
      const subCommands = cmd.getSubCommands();
      if (!commandNamesByCategories.has(category)) {
        commandNamesByCategories.set(category, []);
      }

      if (subCommands && subCommands.length > 0) {
        for (const sub of subCommands) {
          if (!sub.isAdminOnly || this.client.getConfig().ownerIds.includes(userId)) {
            commandNamesByCategories.get(category)?.push(
              `${cmd.getName()} ${sub.getName()}`,
            );
          }
        }
      } else if (!cmd.isAdminOnly || this.client.getConfig().ownerIds.includes(userId)) {
        commandNamesByCategories.get(category)?.push(cmd.getName());
      }
    }
    return commandNamesByCategories;
  }

  /**
   * Retrieves the response for the starting guide.
   * It explains what is the bot, how to install it, log into Todoist
   * and interacte with the bot to create a task.
   */
  private async getStartingGuideResponse(language: Locale): Promise<InteractionEditReplyOptions> {
    const linkButtons = this.getLinkButtons(language);
    const inviteLink = this.client.getInviteLink();
    const backToCommandsButton = new ButtonBuilder()
      .setCustomId(this.buildComponentId(Help.BACK_TO_COMMANDS_ACTION))
      .setLabel(this.translate(language, "buttons.backToCommands"))
      .setStyle(ButtonStyle.Primary);

    const userInstallImage = new AttachmentBuilder(
      readFileSync(join(Help.ASSETS_FOLDER, "user_install.png")),
      { name: "user_install.png" },
    );
    const loginMention = await this.client.getCommandMention("todoist login");
    const addTaskMention = await this.client.getCommandMention("todoist add");

    const step1Text = this.translate(language, "startingGuide.title")
      + "\n" + this.translate(language, "botDescription", {
      githubLink: this.client.getConfig().links.github,
      todoistLink: Help.TODOIST_LINK,
    })
    + "\n" + this.translate(language, "startingGuide.step1.title")
    + "\n" + this.translate(language, "startingGuide.step1.body", { inviteLink });
    const step2Text = this.translate(language, "startingGuide.step2.title")
      + "\n" + this.translate(language, "startingGuide.step2.body", { loginMention });
    const step3Text = this.translate(language, "startingGuide.step3.title")
      + "\n" + this.translate(language, "startingGuide.step3.body", { addTaskMention })
      + "\n\n:soon:"; // TODO imageS : 1 image right click + 1 image opened modal

    return {
      flags: MessageFlags.IsComponentsV2,
      components: [
        this.getBaseContainer()
          .addTextDisplayComponents(textDisplay => textDisplay.setContent(step1Text))
          .addMediaGalleryComponents(mediaGallery =>
            mediaGallery.addItems(mediaGalleryItem =>
              mediaGalleryItem
                .setDescription(this.translate(
                  language,
                  "startingGuide.step1.imageDescription",
                ))
                .setURL("attachment://user_install.png")))
          .addTextDisplayComponents(textDisplay =>
            textDisplay.setContent(
              this.translate(language, "startingGuide.step1.note"),
            ))
          .addSeparatorComponents(this.getBaseSeparator())
          .addTextDisplayComponents(textDisplay =>
            textDisplay.setContent(step2Text))
          .addSeparatorComponents(this.getBaseSeparator())
          .addTextDisplayComponents(textDisplay =>
            textDisplay.setContent(step3Text))
          .addSeparatorComponents(this.getBaseSeparator())
          .addActionRowComponents(actionRow => actionRow.addComponents(linkButtons))
          .addActionRowComponents(
            actionRow => actionRow.addComponents(backToCommandsButton),
          ),
      ],
      files: [userInstallImage],
    };
  }

  private getBaseContainer(): ContainerBuilder {
    return new ContainerBuilder().setAccentColor(BaseCommand.EMBED_COLOR);
  }

  private getBaseSeparator(): SeparatorBuilder {
    return new SeparatorBuilder()
      .setDivider(true)
      .setSpacing(SeparatorSpacingSize.Large);
  }

  /** Builds link buttons used in both command list and starting guide. */
  private getLinkButtons(language: Locale): ButtonBuilder[] {
    const config = this.client.getConfig();
    const inviteLink = this.client.getInviteLink();
    return [
      new ButtonBuilder()
        .setLabel(this.translate(language, "buttons.support"))
        .setStyle(ButtonStyle.Link)
        .setURL(config.links.supportServer),
      new ButtonBuilder()
        .setLabel(this.translate(language, "buttons.invite"))
        .setStyle(ButtonStyle.Link)
        .setURL(inviteLink),
      new ButtonBuilder()
        .setLabel(this.translate(language, "buttons.source"))
        .setStyle(ButtonStyle.Link)
        .setURL(config.links.github),
    ];
  }

  /**
   * Builds the response for a specific command's details,
   * including its description, category and other information.
   * @param language the locale for translation
   * @param command the command to get details from
   * @returns the command details response to send to the user
   */
  private getCommandDetailsResponse(
    language: Locale,
    command: SlashCommand | SubCommand,
  ): InteractionEditReplyOptions {
    const subCommands = command instanceof SlashCommand
      ? command.getSubCommands()
      : undefined;
    const category = command instanceof SlashCommand
      ? command.getCategory()
      : command.getParentCommandCategory();

    return { embeds: [{
      title: command.getName() + (command.isAdminOnly ? " 🔐" : ""),
      color: BaseCommand.EMBED_COLOR,
      fields: [{
        name: this.translate(language, "fields.category"),
        value: this.translateCategoryKey(language, category),
      }, {
        name: this.translate(language, "fields.description"),
        value: this.getCommandDescription(command, language),
      }, {
        name: this.translate(language, "fields.requiredPermissions"),
        value: this.getRequiredPermissionsText(command, language),
      }].concat(subCommands && subCommands.length > 0
        ? [{
            name: this.translate(language, "fields.subcommands"),
            value: subCommands.map(
              sub => `\`${sub.getName()}\` » `
                + this.getCommandDescription(sub, language),
            ).join("\n")
            + `\n\n> ${this.translate(language, "subCommandsHelpTip", {
              command: command.getName(),
            })}`,
          }]
        : []),
    }] };
  }

  private translateCategoryKey(language: Locale, category: string | undefined): string {
    return category
      ? this.translate(language, "categories." + category)
      : this.translate(language, "categories.Other");
  }

  private getShortenedCommandName(commandName: string): string {
    return commandName.length > 20 ? `${commandName.slice(0, 20)}...` : commandName;
  }

  /** Builds the text for the required permissions of a command. */
  private getRequiredPermissionsText(
    command: BaseCommand,
    language: Locale,
  ): string {
    const userPermissions = command.userRequiredPermissions;
    const botPermissions = command.clientRequiredPermissions;
    const noRequiredPermissionsMessage
      = this.translate(language, "noRequiredPermissions");

    if (userPermissions.length === 0 && botPermissions.length === 0) {
      return noRequiredPermissionsMessage;
    } else {
      return [
        userPermissions.length > 0
          ? this.translate(language, "userPermissions", {
              permissions: this.permissionsToText(userPermissions),
            })
          : noRequiredPermissionsMessage,
        botPermissions.length > 0
          ? this.translate(language, "botPermissions", {
              permissions: this.permissionsToText(botPermissions),
            })
          : noRequiredPermissionsMessage,
      ].join("\n");
    }
  }

  private permissionsToText(permissions: PermissionResolvable[]): string {
    return Tickly.permissionsToText(permissions).map(p => `\`${p}\``).join(", ");
  }

  private getCommandDescription(command: BaseCommand, language: Locale): string {
    const data = command.getData();
    return data.description_localizations?.[language]
      ?? data.description ?? "";
  }
}
