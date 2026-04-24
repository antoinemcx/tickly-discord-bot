import type { CommandHandler } from "@bot/handlers/CommandHandler";
import type { Handler } from "@bot/handlers/Handler";
import type { TranslationHandler } from "@bot/handlers/TranslationHandler";
import type { Configuration } from "@bot/Tickly";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type { PermissionResolvable } from "discord.js";
import { Tickly } from "@bot/Tickly";
import { Events } from "discord.js";

let mockedBot: Tickly;
let mockedTodoistClient: TodoistApiClient;
let mockedCommandHandler: CommandHandler;
let mockedEventHandler: Handler;
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
  } as unknown as CommandHandler;
  mockedEventHandler = mockedGenericHandler;
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
    it("should throw if the client is not ready", () => {
      // Arrange
      jest.spyOn(mockedBot, "isReady").mockReturnValue(false);
      // Act & Assert
      expect(() => mockedBot.reloadStatus(0)).toThrow();
    });

    it("should set the status with the guild count", () => {
      // Arrange
      jest.spyOn(mockedBot, "isReady").mockReturnValue(true);
      mockedBot.user = {
        setActivity: jest.fn(),
      } as unknown as Tickly["user"];

      // Act
      mockedBot.reloadStatus(5);

      // Assert
      const botUser = mockedBot.user as NonNullable<typeof mockedBot.user>;
      expect(botUser.setActivity).toHaveBeenCalledWith(
        expect.stringContaining("5 servers"),
        expect.anything(),
      );
    });
  });

  describe("Discord SDK utility methods", () => {
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
