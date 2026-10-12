import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type { Guild, WebhookMessageCreateOptions } from "discord.js";
import GuildDelete from "@bot/events/GuildDelete";
import { config } from "@src/config/loader";

jest.mock("@src/config/loader", () => ({
  config: {
    discordWebhooks: {
      installLogs: "",
    },
  },
}));

const WEBHOOK_URL = "https://discord.com/api/webhooks/123/abc";

describe("GuildDelete", () => {
  let event: GuildDelete;
  let clientMock: Tickly;

  beforeEach(() => {
    jest.clearAllMocks();

    (config as { discordWebhooks: { installLogs: string } })
      .discordWebhooks
      .installLogs = "";

    clientMock = {
      guilds: { cache: { size: 3 } },
      reloadStatus: jest.fn(),
      sendWebhookMessage: jest.fn(),
    } as unknown as Tickly;

    event = new GuildDelete(
      clientMock,
      {} as TodoistApiClient,
      {} as RepositoryFactory,
    );
  });

  describe("execute", () => {
    it("should call reloadStatus", async () => {
      // Act
      await event.execute({} as Guild);
      // Assert
      expect(clientMock.reloadStatus).toHaveBeenCalled();
    });

    it("should not throw when reloadStatus fails", async () => {
      // Arrange
      (clientMock.reloadStatus as jest.Mock)
        .mockRejectedValue(new Error("fail"));
      // Act & Assert
      await expect(event.execute({} as Guild)).resolves.not.toThrow();
    });

    it("should not send webhook when installLogs is empty", async () => {
      // Act
      await event.execute({ name: "Test" } as Guild);
      // Assert
      expect(clientMock.sendWebhookMessage).not.toHaveBeenCalled();
    });

    it("should not send webhook when guild.name is undefined", async () => {
      // Arrange
      (config as { discordWebhooks: { installLogs: string } })
        .discordWebhooks
        .installLogs = WEBHOOK_URL;
      // Act
      await event.execute({ name: undefined } as unknown as Guild);
      // Assert
      expect(clientMock.sendWebhookMessage).not.toHaveBeenCalled();
    });

    it("should send webhook embed when installLogs is configured", async () => {
      // Arrange
      (config as { discordWebhooks: { installLogs: string } })
        .discordWebhooks
        .installLogs = WEBHOOK_URL;
      const guildMock = {
        name: "Test",
        memberCount: 10,
        id: "123",
        iconURL: jest.fn(),
      } as unknown as Guild;

      // Act
      await event.execute(guildMock);

      // Assert
      expect(clientMock.sendWebhookMessage).toHaveBeenCalledWith(
        WEBHOOK_URL,
        expect.objectContaining({ embeds: expect.any(Array) }),
      );
    });

    it("should include guild info in webhook embed", async () => {
      // Arrange
      (config as { discordWebhooks: { installLogs: string } })
        .discordWebhooks
        .installLogs = WEBHOOK_URL;
      let capturedOptions: WebhookMessageCreateOptions | undefined;
      (clientMock.sendWebhookMessage as jest.Mock).mockImplementation(
        (_url: string, opts: WebhookMessageCreateOptions) => {
          capturedOptions = opts;
        },
      );
      const guildMock = {
        name: "Server",
        memberCount: 250,
        id: "999",
        iconURL: jest.fn(),
      } as unknown as Guild;

      // Act
      await event.execute(guildMock);

      // Assert
      interface EmbedData { author?: { name: string }; description?: string }
      const embedData = (capturedOptions!.embeds![0] as { data: EmbedData })
        .data;
      expect(embedData.author?.name).toBe("Server");
      expect(embedData.description).toContain("250");
    });

    it("should not throw when sendWebhookMessage fails", async () => {
      // Arrange
      (config as { discordWebhooks: { installLogs: string } })
        .discordWebhooks
        .installLogs = WEBHOOK_URL;
      (clientMock.sendWebhookMessage as jest.Mock)
        .mockRejectedValue(new Error("fail"));
      const guildMock = {
        name: "Test",
        memberCount: 10,
        id: "123",
        iconURL: jest.fn(),
      } as unknown as Guild;

      // Act & Assert
      await expect(event.execute(guildMock)).resolves.not.toThrow();
    });
  });
});
