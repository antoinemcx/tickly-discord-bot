import type { Guild } from "discord.js";
import { displayWarning } from "@src/utils/logger";
import { Events } from "discord.js";
import { Event } from "./Event";

export default class GuildDelete extends Event<Events.GuildDelete> {
  public override name: Events.GuildDelete = Events.GuildDelete;

  public async execute(_guild: Guild): Promise<void> {
    const cachedGuildCount = this.client.guilds.cache.size;

    try {
      this.client.reloadStatus(cachedGuildCount);
    } catch {
      displayWarning("Failed to update status on guild delete.");
    }
  }
}
