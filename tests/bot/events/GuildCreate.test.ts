import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type {
  Guild,
  GuildMember,
  WebhookMessageCreateOptions,
} from "discord.js";
import GuildCreate from "@bot/events/GuildCreate";
import { config } from "@src/config/loader";

jest.mock("@src/config/loader", () => ({
  config: {
    discordWebhooks: {
      installLogs: "",
    },
  },
}));

const WEBHOOK_URL = "https://discord.com/api/webhooks/123/abc";

describe("GuildCreate", () => {
  let event: GuildCreate;
  let clientMock: Tickly;

  beforeEach(() => {
    jest.clearAllMocks();

    (config as { discordWebhooks: { installLogs: string } })
      .discordWebhooks
      .installLogs = "";

    clientMock = {
      guilds: { cache: { size: 5 } },
      reloadStatus: jest.fn(),
      sendWebhookMessage: jest.fn(),
    } as unknown as Tickly;

    event = new GuildCreate(
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

    it("should send webhook embed when installLogs is configured", async () => {
      // Arrange
      (config as { discordWebhooks: { installLogs: string } })
        .discordWebhooks
        .installLogs = WEBHOOK_URL;
      const guildMock = {
        name: "Test",
        nameAcronym: "T",
        memberCount: 10,
        id: "123",
        iconURL: jest.fn(),
        fetchOwner: jest.fn()
          .mockResolvedValue({ user: { username: "Owner" } }),
      } as unknown as Guild;

      // Act
      await event.execute(guildMock);

      // Assert
      expect(clientMock.sendWebhookMessage).toHaveBeenCalledWith(
        WEBHOOK_URL,
        expect.objectContaining({ embeds: expect.any(Array) }),
      );
    });

    it("should include owner username and guild info in embed", async () => {
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
        nameAcronym: "S",
        memberCount: 250,
        id: "999",
        iconURL: jest.fn(),
        fetchOwner: jest.fn().mockResolvedValue({
          user: { username: "CoolOwner" },
        } as unknown as GuildMember),
      } as unknown as Guild;

      // Act
      await event.execute(guildMock);

      // Assert
      interface EmbedData { author?: { name: string }; description?: string }
      const embedData = (capturedOptions!.embeds![0] as { data: EmbedData })
        .data;
      expect(embedData.author?.name).toBe("Server - S");
      expect(embedData.description).toContain("CoolOwner");
      expect(embedData.description).toContain("250");
    });

    it("should not send webhook when fetchOwner fails", async () => {
      // Arrange
      (config as { discordWebhooks: { installLogs: string } })
        .discordWebhooks
        .installLogs = WEBHOOK_URL;
      const guildMock = {
        name: "Test",
        fetchOwner: jest.fn().mockRejectedValue(new Error("fail")),
      } as unknown as Guild;

      // Act
      await event.execute(guildMock);

      // Assert
      expect(clientMock.sendWebhookMessage).not.toHaveBeenCalled();
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
        nameAcronym: "T",
        memberCount: 10,
        id: "123",
        iconURL: jest.fn(),
        fetchOwner: jest.fn()
          .mockResolvedValue({ user: { username: "O" } }),
      } as unknown as Guild;

      // Act & Assert
      await expect(event.execute(guildMock)).resolves.not.toThrow();
    });
  });
});
