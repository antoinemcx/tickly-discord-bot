import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { Task } from "@doist/todoist-api-typescript";
import type {
  ChatInputCommandInteraction,
  InteractionEditReplyOptions,
  Locale,
  MessageComponentInteraction,
} from "discord.js";
import type { SlashCommandCategory } from "../core/SlashCommand";
import { Tickly } from "@bot/Tickly";
import { OAuthError } from "@services/todoist/errors/OAuthError";
import { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import { displayDetailedError } from "@src/utils/logger";
import {
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  SeparatorSpacingSize,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import { BaseCommand } from "../core/BaseCommand";
import { SubCommand } from "../core/SubCommand";

export enum UpcomingFilter {
  Today = "today",
  Tomorrow = "tomorrow",
  Week = "week",
  Upcoming = "upcoming",
}

const PAGE_SIZE = 10;
const MAX_TASK_COUNT = 200;
const TASK_TITLE_MAX_LENGTH = 50;

/** Displays upcoming and overdue Todoist tasks with filter tabs and pagination. */
export default class Upcoming extends SubCommand {
  readonly data = {
    name: "upcoming",
    options: [{
      name: "period",
      type: ApplicationCommandOptionType.String,
      required: false,
      choices: Object.values(UpcomingFilter).map(v => ({ name: v, value: v })),
    }],
  };

  private static readonly CHANGE_FILTER_ACTION = "change_filter";
  private static readonly NEXT_PAGE_ACTION = "next_page";
  private static readonly PREV_PAGE_ACTION = "prev_page";

  /** Per-user navigation state. Keyed by Discord user ID. */
  private readonly navigationStates = new Map<string, { filter: UpcomingFilter; page: number }>();

  constructor(
    client: Tickly,
    todoistClient: TodoistApiClient,
    repositories: RepositoryFactory,
    parentCommandName: string,
    parentCommandCategory?: SlashCommandCategory,
  ) {
    super(client, todoistClient, repositories, parentCommandName, parentCommandCategory);

    this.onMessageComponent(Upcoming.CHANGE_FILTER_ACTION, async (interaction, language) => {
      if (!interaction.isStringSelectMenu())
        return;
      await interaction.deferUpdate();
      await this.refreshView(interaction, language, interaction.values[0] as UpcomingFilter, 0);
    });

    this.onMessageComponent(Upcoming.NEXT_PAGE_ACTION, async (interaction, language) => {
      await interaction.deferUpdate();
      const { filter, page } = this.navigationStates.get(interaction.user.id)
        ?? { filter: UpcomingFilter.Today, page: 0 };
      await this.refreshView(interaction, language, filter, page + 1);
    });

    this.onMessageComponent(Upcoming.PREV_PAGE_ACTION, async (interaction, language) => {
      await interaction.deferUpdate();
      const { filter, page } = this.navigationStates.get(interaction.user.id)
        ?? { filter: UpcomingFilter.Today, page: 0 };
      await this.refreshView(interaction, language, filter, page - 1);
    });
  }

  public async execute(
    interaction: ChatInputCommandInteraction,
    language: Locale,
  ): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const userId = interaction.user.id;

    let api;
    try {
      api = await this.todoistClient.getUserApi(userId);
    } catch {
      await interaction.editReply({
        content: this.client.getTranslationHandler().translateCommon(
          language,
          "session.invalid",
          { loginCommand: await this.client.getCommandMention("todoist login") },
        ),
      });
      return;
    }

    try { // retrieve tasks
      const tasks = await this.todoistClient.getActiveTasks(userId, api);
      if (!tasks.length) {
        await interaction.editReply({
          content: this.translate(language, "noTasks", {
            i: this.client.getConfig().emotes.i,
            addCommand: await this.client.getCommandMention("todoist add"),
          }),
        });
        return;
      }

      /* Initialize the embed view */
      const categorized = this.categorizeTasks(tasks);
      this.sortTaskGroups(categorized);
      const filter = (interaction.options.getString("period") as UpcomingFilter | null)
        ?? this.getDefaultFilter(categorized);
      await this.applyView(interaction, language, categorized, filter, 0);
    } catch (error) {
      displayDetailedError("Error in Upcoming execute", error);
      await interaction.editReply({
        content: this.translate(language, "fetchError", {
          x: this.client.getConfig().emotes.x,
        }),
      });
    }
  }

  private async refreshView(
    interaction: MessageComponentInteraction,
    language: Locale,
    filter: UpcomingFilter,
    page: number,
  ): Promise<void> {
    const userId = interaction.user.id;
    try {
      const api = await this.todoistClient.getUserApi(userId);
      const tasks = await this.todoistClient.getActiveTasks(userId, api);
      const categorized = this.categorizeTasks(tasks);
      this.sortTaskGroups(categorized);
      await this.applyView(interaction, language, categorized, filter, page);
    } catch (error) {
      displayDetailedError("Error refreshing upcoming tasks", error);
      const content = error instanceof OAuthError
        ? this.client.getTranslationHandler().translateCommon(language, "session.invalid", {
            loginCommand: await this.client.getCommandMention("todoist login"),
          })
        : this.translate(language, "fetchError", { x: this.client.getConfig().emotes.x });
      await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
    }
  }

  private async applyView(
    interaction: ChatInputCommandInteraction | MessageComponentInteraction,
    language: Locale,
    categorized: Record<UpcomingFilter, Task[]>,
    filter: UpcomingFilter,
    page: number,
  ): Promise<void> {
    this.navigationStates.set(interaction.user.id, { filter, page });
    await interaction.editReply(
      this.buildResponse(language, categorized, filter, page),
    );
  }

  /**
   * Builds the response with the filtered tasks, pagination buttons,
   * and filter selection menu.
   */
  private buildResponse(
    language: Locale,
    categorized: Record<UpcomingFilter, Task[]>,
    filter: UpcomingFilter,
    page: number,
  ): InteractionEditReplyOptions {
    const { totalPages, safePage, pageTasks } = this.getPageSlice(
      categorized[filter],
      filter,
      page,
    );
    const totalCount = Object.values(categorized).reduce((n, t) => n + t.length, 0);
    const countDisplay = totalCount >= MAX_TASK_COUNT
      ? `${MAX_TASK_COUNT}+` // maximum indicator
      : String(totalCount);

    /* Build V2 component title */
    const container = new ContainerBuilder().setAccentColor(BaseCommand.EMBED_COLOR);
    container.addTextDisplayComponents(td =>
      td.setContent(`## ${this.translate(language, "title")} (${countDisplay})`));
    container.addSeparatorComponents(sep =>
      sep.setDivider(true).setSpacing(SeparatorSpacingSize.Large));

    /* Display filtered tasks */
    if (!pageTasks.length) {
      container.addTextDisplayComponents(td =>
        td.setContent(this.translate(language, "noTasksForFilter", {
          i: this.client.getConfig().emotes.i,
        })));
    } else {
      this.addTaskSectionToContainer(container, language, pageTasks, filter);
    }

    container.addSeparatorComponents(sep =>
      sep.setDivider(true).setSpacing(SeparatorSpacingSize.Large));

    /* Pagination buttons */
    if (totalPages > 1) {
      container.addActionRowComponents(row =>
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(this.buildComponentId(Upcoming.PREV_PAGE_ACTION))
            .setLabel(this.translate(language, "buttons.prev"))
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(safePage <= 0),
          new ButtonBuilder()
            .setCustomId(this.buildComponentId(Upcoming.NEXT_PAGE_ACTION))
            .setLabel(this.translate(language, "buttons.next"))
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(safePage >= totalPages - 1),
        ));
    }

    /* Period filter selection menu */
    container.addActionRowComponents(row =>
      row.addComponents(this.buildSelectFilter(language, filter, categorized)));

    /* Total page indicator for pagination */
    if (totalPages > 1) {
      container.addTextDisplayComponents(td =>
        td.setContent(this.translate(language, "page", {
          current: String(safePage + 1),
          total: String(totalPages),
        })));
    }

    return { flags: MessageFlags.IsComponentsV2, components: [container] };
  }

  /** @returns the total pages and slice of tasks for the given page */
  private getPageSlice(
    filterTasks: Task[],
    filter: UpcomingFilter,
    page: number,
  ): { totalPages: number; safePage: number; pageTasks: Task[] } {
    if (filter !== UpcomingFilter.Today) { // simple pagination
      const totalPages = Math.max(1, Math.ceil(filterTasks.length / PAGE_SIZE));
      const safePage = Math.min(Math.max(0, page), totalPages - 1);
      return {
        totalPages,
        safePage,
        pageTasks: filterTasks.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE),
      };
    }

    /* Today: up to PAGE_SIZE/2 overdue + PAGE_SIZE/2 same-day tasks per page */
    const today = this.today();
    const HALF = PAGE_SIZE / 2;
    const overdue = filterTasks.filter((t) => {
      const d = TodoistApiClient.getTaskDueDate(t);
      return !!d && d < today;
    });
    const sameDay = filterTasks.filter((t) => {
      const d = TodoistApiClient.getTaskDueDate(t);
      return !d || d >= today;
    });
    const totalPages = Math.max(
      1,
      Math.max(
        Math.ceil(overdue.length / HALF) || 1,
        Math.ceil(sameDay.length / HALF) || 1,
      ),
    );
    const safePage = Math.min(Math.max(0, page), totalPages - 1);

    return {
      totalPages,
      safePage,
      pageTasks: [
        ...overdue.slice(safePage * HALF, (safePage + 1) * HALF),
        ...sameDay.slice(safePage * HALF, (safePage + 1) * HALF),
      ],
    };
  }

  private addTaskSectionToContainer(
    container: ContainerBuilder,
    language: Locale,
    pageTasks: Task[],
    filter: UpcomingFilter,
  ): void {
    if (filter !== UpcomingFilter.Today) { // simple list
      container.addTextDisplayComponents(td =>
        td.setContent(pageTasks.map(t => this.formatTask(t, filter)).join("\n")));
      return;
    }

    /* Today: overdue and same-day tasks in separate sections */
    const today = this.today();
    const overdue = pageTasks.filter((t) => {
      const d = TodoistApiClient.getTaskDueDate(t);
      return !!d && d < today;
    });
    const todayTasks = pageTasks.filter((t) => {
      const d = TodoistApiClient.getTaskDueDate(t);
      return !d || d >= today;
    });

    if (overdue.length) {
      container.addTextDisplayComponents(td =>
        td.setContent(
          `**${this.translate(language, "sections.overdue")}**\n`
          + overdue.map(t => this.formatTask(t, filter)).join("\n"),
        ));
    }
    if (overdue.length && todayTasks.length) {
      container.addSeparatorComponents(sep =>
        sep.setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    }
    if (todayTasks.length) {
      container.addTextDisplayComponents(td =>
        td.setContent(
          `**${this.translate(language, "sections.today")}**\n`
          + todayTasks.map(t => this.formatTask(t, filter)).join("\n"),
        ));
    }
  }

  /** Formats a task with a priority emoji and a date if applicable */
  private formatTask(task: Task, filter: UpcomingFilter): string {
    const emotes = this.client.getConfig().emotes;
    const priorityPrefix = task.priority > 1
      ? emotes.priorities[(5 - task.priority) as keyof typeof emotes.priorities] + " "
      : "";
    const raw = task.content.length > TASK_TITLE_MAX_LENGTH
      ? `${task.content.slice(0, TASK_TITLE_MAX_LENGTH)}…`
      : task.content;

    const dateStr = this.formatDueDate(task, filter);
    return `- ${priorityPrefix}[${Tickly.escapeMarkdownLinkText(raw)}](${task.url})${dateStr ? ` · ${dateStr}` : ""}`;
  }

  /**
   * Formats a due date according to the filter:
   * - Today: show small date for overdue, time for same-day tasks with time
   * - Tomorrow: show time for tasks with time
   * - Other: show small date
   */
  private formatDueDate(task: Task, filter: UpcomingFilter): string | null {
    if (!task.due)
      return null;
    const hasTime = !!task.due.datetime || (task.due.date?.includes("T") ?? false);
    const src = task.due.datetime ?? task.due.date;
    if (!src) {
      return null;
    }
    const timestamp = Math.floor(new Date(src).getTime() / 1000);
    if (Number.isNaN(timestamp)) {
      return task.due.string;
    }

    if (filter === UpcomingFilter.Today) {
      const isOverdue
        = (TodoistApiClient.getTaskDueDate(task)?.getTime() ?? Infinity)
          < this.today().getTime();

      if (isOverdue) { // not the same day, we use small date
        return `<t:${timestamp}:d>`;
      }
      return hasTime ? `<t:${timestamp}:t>` : null;
    } else if (filter === UpcomingFilter.Tomorrow) {
      return hasTime ? `<t:${timestamp}:t>` : null;
    }
    return `<t:${timestamp}:d>`; // small date for other filters
  }

  /**
   * Categorizes tasks into filters based on their due date or lack of date.
   * @param tasks tasks put into filter categories
   * @returns categorized tasks
   */
  private categorizeTasks(tasks: Task[]): Record<UpcomingFilter, Task[]> {
    const today = this.today();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + 7);

    const toFilter = (task: Task): UpcomingFilter => {
      const due = TodoistApiClient.getTaskDueDate(task);
      if (!due)
        return UpcomingFilter.Upcoming;
      if (due <= today)
        return UpcomingFilter.Today;
      if (due.getTime() === tomorrow.getTime())
        return UpcomingFilter.Tomorrow;
      return due <= weekEnd ? UpcomingFilter.Week : UpcomingFilter.Upcoming;
    };

    return tasks.reduce<Record<UpcomingFilter, Task[]>>((acc, task) => {
      acc[toFilter(task)].push(task);
      return acc;
    }, {
      [UpcomingFilter.Today]: [],
      [UpcomingFilter.Tomorrow]: [],
      [UpcomingFilter.Week]: [],
      [UpcomingFilter.Upcoming]: [],
    });
  }

  /**
   * Sorts each task category by priority first and creation date then.
   * @param groups task groups to sort independently
   */
  private sortTaskGroups(groups: Record<UpcomingFilter, Task[]>): void {
    const today = this.today();
    const byPriorityThenTime = (a: Task, b: Task) => {
      const priority = b.priority - a.priority;
      return priority !== 0
        ? priority
        : TodoistApiClient.getTaskTimestamp(a, true)
          - TodoistApiClient.getTaskTimestamp(b, true);
    };

    /* Sort the "Today" tasks by overdue status, then priority */
    groups[UpcomingFilter.Today].sort((a, b) => {
      const aOverdue
        = (TodoistApiClient.getTaskDueDate(a)?.getTime() ?? Infinity)
          < today.getTime();
      const bOverdue
        = (TodoistApiClient.getTaskDueDate(b)?.getTime() ?? Infinity)
          < today.getTime();

      if (aOverdue !== bOverdue) {
        return aOverdue ? -1 : 1;
      }
      return byPriorityThenTime(a, b);
    });

    /* Sort the other by priority then date */
    for (const f of Object.values(UpcomingFilter).filter(f => f !== UpcomingFilter.Today)) {
      groups[f].sort(byPriorityThenTime);
    }
  }

  private getDefaultFilter(categorized: Record<UpcomingFilter, Task[]>): UpcomingFilter {
    return (Object.values(UpcomingFilter) as UpcomingFilter[])
      .find(f => categorized[f].length > 0)
      ?? UpcomingFilter.Today;
  }

  private buildSelectFilter(
    language: Locale,
    currentFilter: UpcomingFilter,
    categorized: Record<UpcomingFilter, Task[]>,
  ): StringSelectMenuBuilder {
    return new StringSelectMenuBuilder()
      .setCustomId(this.buildComponentId(Upcoming.CHANGE_FILTER_ACTION))
      .addOptions(
        (Object.values(UpcomingFilter) as UpcomingFilter[]).map(f =>
          new StringSelectMenuOptionBuilder()
            .setLabel(`${this.translate(language, `filters.${f}`)} (${categorized[f].length})`)
            .setValue(f)
            .setDefault(f === currentFilter)),
      );
  }

  private today(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
}
