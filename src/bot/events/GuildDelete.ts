import type { Guild } from "discord.js";
import { config } from "@src/config/loader";
import { displayDetailedError, displayWarning } from "@src/utils/logger";
import { EmbedBuilder, Events } from "discord.js";
import { Event } from "./Event";

export default class GuildDelete extends Event<Events.GuildDelete> {
  public override name: Events.GuildDelete = Events.GuildDelete;

  public async execute(guild: Guild): Promise<void> {
    try {
      await this.client.reloadStatus();
    } catch {
      displayWarning("Failed to update status on guild delete.");
    }

    /* Log guild uninstall if configured */
    const webhookUrl = config.discordWebhooks.installLogs;
    if (webhookUrl && guild.name) {
      await this.logUninstall(guild, webhookUrl);
    }
  }

  private async logUninstall(guild: Guild, webhookUrl: string): Promise<void> {
    try {
      const guildCount = this.client.guilds.cache.size;
      const embed = new EmbedBuilder()
        .setColor(0xE24646)
        .setThumbnail(guild.iconURL({ size: 1024 }))
        .setAuthor({
          name: guild.name,
          iconURL: guild.iconURL() ?? undefined,
        })
        .setDescription(
          `I was removed from a server with **${guild.memberCount}** members.\n`
          + `⬅️ I'm now on **${guildCount}** servers.`,
        )
        .setFooter({ text: `ID: ${guild.id}` })
        .setTimestamp();

      await this.client.sendWebhookMessage(webhookUrl, { embeds: [embed] });
    } catch (sendError) {
      displayDetailedError("Failed to send uninstall log to webhook.", sendError);
    }
  }
}
