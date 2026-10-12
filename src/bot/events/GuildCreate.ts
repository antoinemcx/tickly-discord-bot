import type { Guild, GuildMember } from "discord.js";
import { config } from "@src/config/loader";
import { displayDetailedError, displayWarning } from "@src/utils/logger";
import { EmbedBuilder, Events } from "discord.js";
import { Event } from "./Event";

export default class GuildCreate extends Event<Events.GuildCreate> {
  public override name: Events.GuildCreate = Events.GuildCreate;

  public async execute(guild: Guild): Promise<void> {
    try {
      await this.client.reloadStatus();
    } catch {
      displayWarning("Failed to update status on guild create.");
    }

    /* Log guild install if configured */
    const webhookUrl = config.discordWebhooks.installLogs;
    if (webhookUrl) {
      await this.logInstall(guild, webhookUrl);
    }
  }

  private async logInstall(guild: Guild, webhookUrl: string): Promise<void> {
    let owner: GuildMember;
    try {
      owner = await guild.fetchOwner();
    } catch (e) {
      displayDetailedError("Failed to fetch guild owner for install log.", e);
      return;
    }

    try {
      const guildCount = this.client.guilds.cache.size;
      const embed = new EmbedBuilder()
        .setColor(0x22C55E)
        .setThumbnail(guild.iconURL({ size: 1024 }))
        .setAuthor({
          name: `${guild.name} - ${guild.nameAcronym}`,
          iconURL: guild.iconURL() ?? undefined,
        })
        .setDescription(
          `\`${owner.user.username}\` added me to their server with `
          + `**${guild.memberCount}** members!\n`
          + `➡️ I'm now on **${guildCount}** servers.`,
        )
        .setFooter({ text: `ID: ${guild.id}` })
        .setTimestamp();

      await this.client.sendWebhookMessage(webhookUrl, { embeds: [embed] });
    } catch (sendError) {
      displayDetailedError("Failed to send install log to webhook.", sendError);
    }
  }
}
