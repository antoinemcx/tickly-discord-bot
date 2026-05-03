import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type { ChatInputCommandInteraction, Locale } from "discord.js";
import { SlashCommand } from "../SlashCommand";
import Login from "./Login";

export default class Todoist extends SlashCommand {
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
      new Login(client, todoistClient, repositories, this.data.name),
    ];
  }

  public async execute(
    _interaction: ChatInputCommandInteraction,
    _language: Locale,
  ): Promise<void> {
    /* Subcommand container command, should never be executed */
  }
}
