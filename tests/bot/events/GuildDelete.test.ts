import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type { Guild } from "discord.js";
import GuildDelete from "@bot/events/GuildDelete";
import { displayWarning } from "@src/utils/logger";

jest.mock("@src/utils/logger", () => ({
  displayWarning: jest.fn(),
}));

describe("GuildDelete", () => {
  let event: GuildDelete;
  let clientMock: Tickly;

  beforeEach(() => {
    jest.clearAllMocks();

    // Arrange
    clientMock = {
      guilds: {
        cache: {
          size: 3,
        },
      },
      reloadStatus: jest.fn(),
    } as unknown as Tickly;

    event = new GuildDelete(
      clientMock,
      {} as TodoistApiClient,
      {} as RepositoryFactory,
    );
  });

  describe("execute", () => {
    it("should call reloadStatus with the guild count", async () => {
      // Arrange
      const guildMock = {} as Guild;

      // Act
      await event.execute(guildMock);

      // Assert
      expect(clientMock.reloadStatus).toHaveBeenCalledWith(3);
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
        "Failed to update status on guild delete.",
      );
    });
  });
});
