import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type { Guild } from "discord.js";
import GuildCreate from "@bot/events/GuildCreate";
import { displayWarning } from "@src/utils/logger";

jest.mock("@src/utils/logger", () => ({
  displayWarning: jest.fn(),
}));

describe("GuildCreate", () => {
  let event: GuildCreate;
  let clientMock: Tickly;

  beforeEach(() => {
    jest.clearAllMocks();

    // Arrange
    clientMock = {
      guilds: {
        cache: {
          size: 5,
        },
      },
      reloadStatus: jest.fn(),
    } as unknown as Tickly;

    event = new GuildCreate(
      clientMock,
      {} as TodoistApiClient,
      {} as RepositoryFactory,
    );
  });

  describe("execute", () => {
    it("should call reloadStatus", async () => {
      // Arrange
      const guildMock = {} as Guild;
      // Act
      await event.execute(guildMock);
      // Assert
      expect(clientMock.reloadStatus).toHaveBeenCalled();
    });

    it("should silent but log errors from reloadStatus", async () => {
      // Arrange
      const guildMock = {} as Guild;
      (clientMock.reloadStatus as jest.Mock).mockImplementation(() => {
        throw new Error("Status reload failed");
      });

      // Act
      await event.execute(guildMock);

      // Assert
      expect(displayWarning).toHaveBeenCalledWith(
        "Failed to update status on guild create.",
      );
    });
  });
});
