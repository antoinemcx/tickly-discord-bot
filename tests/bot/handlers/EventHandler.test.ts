import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { Event } from "@bot/events/Event";
import { EventHandler } from "@bot/handlers/EventHandler";
import { Events } from "discord.js";

jest.mock("node:fs", () => ({
  readdirSync: jest.fn(),
  statSync: jest.fn(),
}));

describe("EventHandler", () => {
  let handler: EventHandler;
  let clientMock: Tickly;

  beforeEach(() => {
    jest.clearAllMocks();

    // Arrange
    handler = new EventHandler({} as TodoistApiClient, {} as RepositoryFactory);
    clientMock = {
      on: jest.fn(),
      once: jest.fn(),
    } as unknown as Tickly;

    jest.mocked(readdirSync).mockReturnValue([]);
    jest.mocked(statSync).mockReturnValue({
      isFile: jest.fn().mockReturnValue(false),
    } as any);
  });

  describe("setup", () => {
    it("should throw when client is not set", async () => {
      // Act
      const result = handler.setup();
      // Assert
      await expect(result).rejects.toThrow();
    });

    it("should load events with default export and ignore files without default export", async () => {
      // Arrange
      const defaultEventFile = "MockDefaultEvent.ts";
      const noDefaultEventFile = "MockNoDefaultEvent.ts";
      const defaultEventPath = join(EventHandler.eventsDirectory, defaultEventFile);
      const noDefaultEventPath = join(EventHandler.eventsDirectory, noDefaultEventFile);

      jest.doMock(defaultEventPath, () => ({
        __esModule: true,
        default: class MockDefaultEvent extends Event<Events.ThreadCreate> {
          public name: Events.ThreadCreate = Events.ThreadCreate;
          public once = false;
          public async execute(): Promise<void> { /* empty body */ }
        },
      }), { virtual: true });
      jest.doMock(noDefaultEventPath, () => ({
        __esModule: true,
        MockNoDefaultEvent: class MockNoDefaultEvent extends Event<Events.GuildCreate> {
          public name: Events.GuildCreate = Events.GuildCreate;
          public once = false;
          public async execute(): Promise<void> { /* empty body */ }
        },
      }), { virtual: true });

      jest.mocked(readdirSync).mockReturnValue([defaultEventFile, noDefaultEventFile] as any);
      jest.mocked(statSync).mockReturnValue({
        isFile: jest.fn().mockReturnValue(true),
      } as any);
      handler.setClient(clientMock);

      // Act
      await handler.setup();

      // Assert
      expect(readdirSync).toHaveBeenCalledWith(EventHandler.eventsDirectory);
      expect(clientMock.on).toHaveBeenCalledWith(
        Events.ThreadCreate,
        expect.any(Function),
      );
      expect(clientMock.on).toHaveBeenCalledTimes(3);
      expect(clientMock.once).not.toHaveBeenCalled();
    });

    it("should load events with once property set to true", async () => {
      // Arrange
      const onceEventFile = "MockOnceEvent.ts";
      const onceEventPath = join(EventHandler.eventsDirectory, onceEventFile);

      jest.doMock(onceEventPath, () => ({
        __esModule: true,
        default: class MockOnceEvent extends Event<Events.GuildCreate> {
          public name: Events.GuildCreate = Events.GuildCreate;
          public once = true;

          public async execute(): Promise<void> { /* empty body */ }
        },
      }), { virtual: true });

      jest.mocked(readdirSync).mockReturnValue([onceEventFile] as any);
      jest.mocked(statSync).mockReturnValue({
        isFile: jest.fn().mockReturnValue(true),
      } as any);
      handler.setClient(clientMock);

      // Act
      await handler.setup();

      // Assert
      expect(clientMock.once).toHaveBeenCalledWith(
        Events.GuildCreate,
        expect.any(Function),
      );
    });

    it("should load error events", async () => {
      // Arrange
      jest.mocked(readdirSync).mockReturnValue([]);
      handler.setClient(clientMock);

      // Act
      await handler.setup();

      // Assert
      expect(clientMock.on).toHaveBeenCalledWith("warn", console.warn);
      expect(clientMock.on).toHaveBeenCalledWith("error", console.error);
    });
  });
});
