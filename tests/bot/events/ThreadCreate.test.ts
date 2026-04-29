import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type { AnyThreadChannel } from "discord.js";
import ThreadCreate from "@bot/events/ThreadCreate";

describe("ThreadCreate", () => {
  let event: ThreadCreate;
  let clientMock: Tickly;

  beforeEach(() => {
    jest.clearAllMocks();

    // Arrange
    clientMock = {} as Tickly;

    event = new ThreadCreate(
      clientMock,
      {} as TodoistApiClient,
      {} as RepositoryFactory,
    );
  });

  describe("execute", () => {
    it("should join thread when thread is joinable", async () => {
      // Arrange
      const threadMock = {
        joinable: true,
        join: jest.fn().mockResolvedValue(undefined),
      } as unknown as AnyThreadChannel;

      // Act
      await event.execute(threadMock);

      // Assert
      expect(threadMock.join).toHaveBeenCalled();
    });

    it("should not join thread when thread is not joinable", async () => {
      // Arrange
      const threadMock = {
        joinable: false,
        join: jest.fn(),
      } as unknown as AnyThreadChannel;

      // Act
      await event.execute(threadMock);

      // Assert
      expect(threadMock.join).not.toHaveBeenCalled();
    });

    it("should silent join errors", async () => {
      // Arrange
      const threadMock = {
        joinable: true,
        join: jest.fn().mockRejectedValue(new Error("Join failed")),
      } as unknown as AnyThreadChannel;

      // Act & Assert
      await expect(event.execute(threadMock)).resolves.toBeUndefined();
      expect(threadMock.join).toHaveBeenCalled();
    });
  });
});
