import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type { ChatInputCommandInteraction, Locale } from "discord.js";
import { SlashCommand, SlashCommandCategory } from "../SlashCommand";
import Login from "./Login";
import Logout from "./Logout";
import TaskAdd from "./TaskAdd";

export default class Todoist extends SlashCommand {
  readonly category = SlashCommandCategory.Todoist;
  readonly data = {
    name: "todoist",
  };

  constructor(
    client: Tickly,
    todoistClient: TodoistApiClient,
    repositories: RepositoryFactory,
  ) {
    super(client, todoistClient, repositories);
    this.subcommands = [
      new Login(
        client,
        todoistClient,
        repositories,
        this.data.name,
        this.category,
      ),
      new Logout(
        client,
        todoistClient,
        repositories,
        this.data.name,
        this.category,
      ),
      new TaskAdd(
        client,
        todoistClient,
        repositories,
        this.data.name,
        this.category,
      ),
    ];
  }

  public async execute(
    _interaction: ChatInputCommandInteraction,
    _language: Locale,
  ): Promise<void> {
    /* Subcommand container command, should never be executed */
  }
}
