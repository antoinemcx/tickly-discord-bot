import type { APIApplicationCommand } from "discord.js";
import type { CommandData } from "./BaseCommand";
import { ApplicationIntegrationType } from "discord.js";
import { LocalizedCommand } from "./LocalizedCommand";

/** Base class for all discord bots commands. */
export abstract class RegisterableBaseCommand extends LocalizedCommand {
  /** Discord API data to register the command. */
  protected abstract readonly data: CommandData;

  /** Discord API command type. */
  protected abstract readonly type: APIApplicationCommand["type"];

  /**
   * Retrieves the data and type of the command to register it.
   * By default, the command is registered for both guild and global use,
   * but this can be overridden.
   * @returns the data to register the command
   */
  public getData(): CommandData & { type: APIApplicationCommand["type"] } {
    return {
      ...this.data,
      type: this.type,
      integration_types: this.data.integration_types ?? [
        ApplicationIntegrationType.GuildInstall,
        ApplicationIntegrationType.UserInstall,
      ],
    };
  }
}
