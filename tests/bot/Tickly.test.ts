import type { CommandHandler } from "@bot/handlers/CommandHandler";
import type { EventHandler } from "@bot/handlers/EventHandler";
import type { Handler } from "@bot/handlers/Handler";
import type { TranslationHandler } from "@bot/handlers/TranslationHandler";
import type { Configuration } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type { ApplicationCommand, PermissionResolvable } from "discord.js";
import Ping from "@bot/commands/bot/Ping";
import { Tickly } from "@bot/Tickly";
import { Events } from "discord.js";

let mockedBot: Tickly;
let mockedTodoistClient: TodoistApiClient;
let mockedCommandHandler: CommandHandler;
let mockedEventHandler: EventHandler;
let mockedTranslationHandler: TranslationHandler;

beforeEach(() => {
  const mockedGenericHandler = {
    setClient: jest.fn(),
    setup: jest.fn().mockResolvedValue(undefined),
  } as unknown as Handler;

  mockedTodoistClient = {} as TodoistApiClient;
  mockedCommandHandler = {
    ...mockedGenericHandler,
    registerCommands: jest.fn().mockResolvedValue(undefined),
    getSlashCommands: jest.fn().mockReturnValue(new Map()),
  } as unknown as CommandHandler;
  mockedEventHandler = mockedGenericHandler as EventHandler;
  mockedTranslationHandler = mockedGenericHandler as TranslationHandler;

  // Arrange
  mockedBot = new Tickly(
    "fakeToken",
    { defaultLocale: "en-US" } as Configuration,
    mockedTodoistClient,
    mockedCommandHandler,
    mockedEventHandler,
    mockedTranslationHandler,
  );
});

describe("Tickly", () => {
  describe("Constructor", () => {
    it("should throw with missing token", () => {
      // Arrange
      const missingToken = "";

      // Act & Assert
      expect(() => {
        const _ = new Tickly(
          missingToken,
          { defaultLocale: "en-US" } as Configuration,
          mockedTodoistClient,
          mockedCommandHandler,
          mockedEventHandler,
          mockedTranslationHandler,
        );
      }).toThrow("Missing bot token in the configuration.");
    });

    it("should create", () => {
      // Assert
      expect(mockedBot).toBeInstanceOf(Tickly);
    });

    it("should set the client for handlers", () => {
      // Assert
      expect(mockedCommandHandler.setClient).toHaveBeenCalledWith(mockedBot);
      expect(mockedEventHandler.setClient).toHaveBeenCalledWith(mockedBot);
      expect(mockedTranslationHandler.setClient).toHaveBeenCalledWith(mockedBot);
    });
  });

  describe("getSlashCommandByName", () => {
    const mockedRepositoryFactory = {} as RepositoryFactory;

    it("should return undefined with empty command name", () => {
      // Assert
      const commandName = "";
      // Act
      const result = mockedBot.getSlashCommandByName(commandName);
      // Assert
      expect(result).toBeUndefined();
    });

    it("should return undefined with unknown command name", () => {
      // Arrange
      const commandName = "unknown";
      mockedCommandHandler.getSlashCommands = jest.fn().mockReturnValue(
        new Map([
          ["ping", new Ping(mockedBot, mockedTodoistClient, mockedRepositoryFactory)],
        ]),
      );

      // Act
      const result = mockedBot.getSlashCommandByName(commandName);

      // Assert
      expect(result).toBeUndefined();
    });

    it("should return the command with a known command name", () => {
      // Arrange
      const commandName = "ping";
      const pingCommand = new Ping(mockedBot, mockedTodoistClient, mockedRepositoryFactory);
      mockedCommandHandler.getSlashCommands = jest.fn().mockReturnValue(
        new Map([["ping", pingCommand]]),
      );

      // Act
      const result = mockedBot.getSlashCommandByName(commandName);

      // Assert
      expect(result).toBe(pingCommand);
    });

    it("should return the main command even with a nested command name", () => {
      // Arrange
      const commandName = "ping subcommand";
      const pingCommand = new Ping(mockedBot, mockedTodoistClient, mockedRepositoryFactory);
      mockedCommandHandler.getSlashCommands = jest.fn().mockReturnValue(
        new Map([["ping", pingCommand]]),
      );

      // Act
      const result = mockedBot.getSlashCommandByName(commandName);

      // Assert
      expect(result).toBe(pingCommand);
    });
  });

  describe("start", () => {
    beforeEach(() => {
      mockedBot.login = jest.fn().mockResolvedValue("fakeToken");
      mockedBot.once = jest.fn().mockImplementation((event, listener) => {
        if (event === Events.ClientReady) { // simulate immediate ready event
          listener();
        }
        return mockedBot;
      });
      jest.spyOn(mockedBot, "isReady").mockReturnValue(true);
    });

    it("should run the handlers setup", async () => {
      // Act
      await mockedBot.start();

      // Assert
      expect(mockedCommandHandler.setup).toHaveBeenCalled();
      expect(mockedEventHandler.setup).toHaveBeenCalled();
      expect(mockedTranslationHandler.setup).toHaveBeenCalled();
    });

    it("should log in the bot to Discord", async () => {
      // Act
      await mockedBot.start();

      // Assert
      expect(mockedBot.login).toHaveBeenCalledWith("fakeToken");
    });

    it("should register commands once the bot is ready", async () => {
      // Act
      await mockedBot.start();

      // Assert
      expect(mockedBot.once).toHaveBeenCalledWith(
        Events.ClientReady,
        expect.any(Function),
      );
      expect(mockedCommandHandler.registerCommands).toHaveBeenCalled();
    });
  });

  describe("reloadStatus", () => {
    it("should throw if the client is not ready", async () => {
      // Arrange
      jest.spyOn(mockedBot, "isReady").mockReturnValue(false);
      // Act & Assert
      await expect(mockedBot.reloadStatus(0)).rejects.toThrow();
    });

    it("should set the status with the guild and user counts", async () => {
      // Arrange
      jest.spyOn(mockedBot, "isReady").mockReturnValue(true);
      mockedBot.user = {
        setActivity: jest.fn(),
      } as unknown as Tickly["user"];

      // Act
      await mockedBot.reloadStatus(5, 10);

      // Assert
      const botUser = mockedBot.user as NonNullable<typeof mockedBot.user>;
      expect(botUser.setActivity).toHaveBeenCalledWith(
        expect.stringContaining("10 users, 5 guilds"),
        expect.anything(),
      );
    });

    it("should fetch counts from the API if not provided", async () => {
      // Arrange
      jest.spyOn(mockedBot, "isReady").mockReturnValue(true);
      mockedBot.user = {
        setActivity: jest.fn(),
      } as unknown as Tickly["user"];
      mockedBot.application = {
        fetch: jest.fn().mockResolvedValue({
          approximateGuildCount: 1,
          approximateUserInstallCount: 7,
        }),
      } as unknown as Tickly["application"];

      // Act
      await mockedBot.reloadStatus();

      // Assert
      expect(mockedBot.application?.fetch).toHaveBeenCalled();
      const botUser = mockedBot.user as NonNullable<typeof mockedBot.user>;
      expect(botUser.setActivity).toHaveBeenCalledWith(
        expect.stringContaining("7 users, 1 guild"),
        expect.anything(),
      );
    });

    it("should format counts according to the english locale", async () => {
      // Arrange
      jest.spyOn(mockedBot, "isReady").mockReturnValue(true);
      mockedBot.user = {
        setActivity: jest.fn(),
      } as unknown as Tickly["user"];
      mockedBot.application = {
        fetch: jest.fn().mockResolvedValue({
          approximateGuildCount: 1234,
          approximateUserInstallCount: 56789,
        }),
      } as unknown as Tickly["application"];

      // Act
      await mockedBot.reloadStatus();

      // Assert
      const botUser = mockedBot.user as NonNullable<typeof mockedBot.user>;
      expect(botUser.setActivity).toHaveBeenCalledWith(
        expect.stringContaining("56,789 users, 1,234 guilds"),
        expect.anything(),
      );
    });
  });

  describe("getInviteLink", () => {
    it("should return an invite link containing the application ID", () => {
      // Arrange
      mockedBot.application = { id: "12345" } as unknown as Tickly["application"];
      // Act
      const inviteLink = mockedBot.getInviteLink();
      // Assert
      expect(inviteLink).toBe("https://discord.com/oauth2/authorize?client_id=12345");
    });
  });

  describe("Discord SDK utility methods", () => {
    describe("getCommandMention", () => {
      it("should return a mention for an existing command", async () => {
        // Arrange
        const mockCommand = { id: "12345", name: "test" } as ApplicationCommand;
        mockedBot.application = {
          commands: {
            fetch: jest.fn().mockResolvedValue([mockCommand]),
          },
        } as unknown as Tickly["application"];

        // Act
        const result = await mockedBot.getCommandMention("test");

        // Assert
        expect(result).toBe("</test:12345>");
      });

      it("should retrieve commands with the correct guild ID when provided", async () => {
        // Arrange
        const mockCommand = { id: "12345", name: "test" } as ApplicationCommand;
        mockedBot.application = {
          commands: {
            fetch: jest.fn().mockResolvedValue([mockCommand]),
          },
        } as unknown as Tickly["application"];
        const guildId = "67890";

        // Act
        await mockedBot.getCommandMention("test", guildId);

        // Assert
        expect(mockedBot.application?.commands.fetch).toHaveBeenCalledWith({ guildId });
      });

      it("should return a fallback mention if the application is not available", async () => {
        // Arrange
        mockedBot.application = null;
        // Act
        const result = await mockedBot.getCommandMention("test");
        // Assert
        expect(result).toBe("`/test`");
      });

      it("should return a fallback mention if the command cannot be fetched", async () => {
        // Arrange
        mockedBot.application = {
          commands: {
            fetch: jest.fn().mockRejectedValue(new Error("Fetch failed")),
          },
        } as unknown as Tickly["application"];

        // Act
        const result = await mockedBot.getCommandMention("test");

        // Assert
        expect(result).toBe("`/test`");
      });

      it("should return a fallback mention if the command is not found", async () => {
        // Arrange
        mockedBot.application = {
          commands: {
            fetch: jest.fn().mockResolvedValue([]),
          },
        } as unknown as Tickly["application"];

        // Act
        const result = await mockedBot.getCommandMention("test");

        // Assert
        expect(result).toBe("`/test`");
      });
    });

    describe("permissionsToText", () => {
      it("should convert permissions to text", () => {
        // Arrange
        const permissions: PermissionResolvable[]
          = ["Administrator", "ManageMessages"];
        // Act
        const result = Tickly.permissionsToText(permissions);
        // Assert
        expect(result).toEqual(["Administrator", "ManageMessages"]);
      });
    });
  });
});
