import type { BaseCommand } from "@bot/commands/BaseCommand";
import type { MessageCommand } from "@bot/commands/MessageCommand";
import type { SubCommand } from "@bot/commands/SubCommand";
import type { UserCommand } from "@bot/commands/UserCommand";
import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { UserRepository } from "@database/repositories/UserRepository";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type { CommandInteraction } from "discord.js";
import { readdirSync, statSync } from "node:fs";
import { SlashCommand } from "@bot/commands/SlashCommand";
import { CommandHandler } from "@bot/handlers/CommandHandler";
import { Events, Locale, REST, Routes } from "discord.js";

jest.mock("node:fs", () => ({
  readdirSync: jest.fn(),
  statSync: jest.fn(),
}));

jest.mock("discord.js", () => {
  const actual = jest.requireActual("discord.js");

  return {
    ...actual,
    REST: jest.fn(),
    Routes: {
      applicationCommands: jest.fn(),
      applicationGuildCommands: jest.fn(),
    },
  };
});

function createInteraction(overrides: Record<string, unknown> = {}) {
  return {
    locale: "en-US",
    commandName: "ping",
    user: { id: "user-id" },
    isChatInputCommand: jest.fn().mockReturnValue(true),
    isMessageContextMenuCommand: jest.fn().mockReturnValue(false),
    isUserContextMenuCommand: jest.fn().mockReturnValue(false),
    isCommand: jest.fn().mockReturnValue(true),
    reply: jest.fn(),
    editReply: jest.fn(),
    ...overrides,
  };
}

function createCommand(
  execute: jest.Mock,
  overrides: Record<string, unknown> = {},
): BaseCommand {
  return {
    getName: jest.fn().mockReturnValue("ping"),
    getData: jest.fn().mockReturnValue({ name: "ping" }),
    hasUserPermission: jest.fn().mockReturnValue(true),
    hasBotPermission: jest.fn().mockReturnValue(true),
    execute,
    ...overrides,
  } as unknown as BaseCommand;
}

function createSlashCommand(
  execute: jest.Mock,
  overrides: Record<string, unknown> = {},
): SlashCommand {
  const command = {
    ...createCommand(execute, overrides),
    getSubCommands: jest.fn().mockReturnValue([]),
    ...overrides,
  } as unknown as SlashCommand;
  Object.setPrototypeOf(command, SlashCommand.prototype);
  return command;
}

describe("CommandHandler", () => {
  let handler: CommandHandler;
  let clientMock: Tickly;
  let restMock: {
    put: jest.Mock;
    setToken: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Arrange
    jest.mocked(readdirSync).mockReturnValue([]);
    jest.mocked(statSync).mockReturnValue({
      isDirectory: jest.fn().mockReturnValue(false),
    } as any);

    restMock = {
      put: jest.fn().mockResolvedValue(undefined),
      setToken: jest.fn(),
    };
    restMock.setToken.mockReturnValue(restMock);
    (REST as unknown as jest.Mock).mockImplementation(() => restMock);
    (Routes.applicationCommands as jest.Mock).mockReturnValue("global-route");
    (Routes.applicationGuildCommands as jest.Mock).mockReturnValue("guild-route");

    handler = new CommandHandler(
      {} as TodoistApiClient,
      {
        getLanguageRepository: jest.fn(),
        getUserRepository: jest.fn(),
        getUserSessionRepository: jest.fn(),
      } as unknown as RepositoryFactory,
    );
    clientMock = {
      once: jest.fn().mockImplementation((event, listener) => {
        if (event === Events.ClientReady) {
          listener();
        }
        return clientMock;
      }),
      on: jest.fn(),
      isReady: jest.fn().mockReturnValue(true),
      getTranslationHandler: jest.fn(),
      user: { id: "bot-id" },
    } as unknown as Tickly;
  });

  describe("setup", () => {
    it("should throw when the client is not set", async () => {
      // Act
      const result = handler.setup();
      // Assert
      await expect(result).rejects.toThrow();
    });

    it("should load commands recursively from command category directories", async () => {
      // Arrange
      (readdirSync as unknown as jest.Mock).mockImplementation((path: any) => {
        const current = String(path).split(/[\\/]/).at(-1);

        if (current === "commands") {
          return ["bot"];
        } else if (current === "nested") {
          return [String.raw`..\Ping.ts`];
        } else if (current === "bot") {
          return ["nested"];
        }
        return [];
      });
      (statSync as unknown as jest.Mock).mockImplementation((path: any) => ({
        isDirectory: () => {
          const current = String(path).split(/[\\/]/).at(-1);

          return current === "bot" || current === "nested";
        },
      } as any));
      handler.setClient(clientMock);

      // Act
      await handler.setup();

      // Assert
      expect(readdirSync).toHaveBeenCalledWith(CommandHandler.commandsDirectory);
      expect(Array.from(handler.getAllCommands().keys())).toContain("ping");
    });

    it("should ignore root files and non-BaseCommand default exports", async () => {
      // Arrange
      (readdirSync as unknown as jest.Mock).mockImplementation((path: any) => {
        const current = String(path).split(/[\\/]/).at(-1);

        if (current === "commands") {
          return ["bot", "BaseCommand.ts", "not-found.ts"];
        } else if (current === "bot") {
          return [String.raw`..\BaseCommand.ts`, "Ping.ts"];
        }
        return [];
      });
      (statSync as unknown as jest.Mock).mockImplementation((path: any) => ({
        isDirectory: () => String(path).split(/[\\/]/).at(-1) === "bot",
      } as any));
      handler.setClient(clientMock);

      // Act
      await handler.setup();

      // Assert
      expect(Array.from(handler.getAllCommands().keys())).toEqual(["ping"]);
    });

    it("should listen for interaction create events once the bot is ready", async () => {
      // Arrange
      handler.setClient(clientMock);

      // Act
      await handler.setup();

      // Assert
      expect(clientMock.once).toHaveBeenCalledWith(
        Events.ClientReady,
        expect.any(Function),
      );
      expect(clientMock.on).toHaveBeenCalledWith(
        Events.InteractionCreate,
        expect.any(Function),
      );
    });

    describe("interaction handling", () => {
      let interactionHandler: CommandHandler;
      let interactionClientMock: Tickly;
      let interactionListener: (interaction: any) => Promise<void>;
      let userRepositoryMock: Pick<UserRepository, "getUserPreferredLanguage">;

      beforeAll(async () => {
        /* Repositories mock */
        const repositoriesMock = {
          getLanguageRepository: jest.fn(),
          getUserRepository: jest.fn(),
          getUserSessionRepository: jest.fn(),
        };
        userRepositoryMock = {
          getUserPreferredLanguage: jest.fn(),
        };
        repositoriesMock.getUserRepository.mockReturnValue(userRepositoryMock);

        /* Translation mock */
        const translateCommonMock
          = jest.fn().mockImplementation((_: Locale, translationKey: string) => {
            if (translationKey.startsWith("interactionHandling.")) {
              return translationKey.split(".").slice(1).join(".");
            }
            return "translated";
          });

        interactionHandler = new CommandHandler(
          {} as TodoistApiClient,
          repositoriesMock as unknown as RepositoryFactory,
        );
        interactionClientMock = {
          once: jest.fn().mockImplementation((event, listener) => {
            if (event === Events.ClientReady) {
              listener();
            }
            return interactionClientMock;
          }),
          on: jest.fn(),
          isReady: jest.fn().mockReturnValue(true),
          getTranslationHandler: jest.fn().mockReturnValue({
            isSupportedLocale: jest.fn().mockReturnValue(true),
            getDefaultLocale: jest.fn().mockReturnValue(Locale.EnglishUS),
            translateCommon: translateCommonMock,
          }),
          getConfig: jest.fn().mockReturnValue({ ownerIds: [] }),
          user: { id: "bot-id" },
        } as unknown as Tickly;

        (readdirSync as unknown as jest.Mock).mockReturnValue([]);
        (statSync as unknown as jest.Mock).mockReturnValue({
          isDirectory: jest.fn().mockReturnValue(false),
        } as any);

        interactionHandler.setClient(interactionClientMock);
        await interactionHandler.setup();
        interactionListener = (interactionClientMock.on as jest.Mock).mock.calls[0][1];
      });

      beforeEach(() => {
        (interactionHandler as any).slashCommands.clear();
        (interactionHandler as any).messageContextMenuCommands.clear();
        (interactionHandler as any).userContextMenuCommands.clear();
        (interactionClientMock.getConfig as jest.Mock).mockReturnValue({ ownerIds: [] });
        (userRepositoryMock.getUserPreferredLanguage as jest.Mock).mockReset();
        (userRepositoryMock.getUserPreferredLanguage as jest.Mock)
          .mockResolvedValue(undefined);
      });

      it("should do nothing when no command is found", async () => {
        // Arrange
        const interaction = createInteraction({ commandName: "missing" });
        // Act
        await interactionListener(interaction);
        // Assert
        expect(interaction.reply).not.toHaveBeenCalled();
      });

      it("should execute matching slash command for chat input interactions", async () => {
        // Arrange
        const execute = jest.fn().mockResolvedValue(undefined);
        (interactionHandler as any).slashCommands.set(
          "ping",
          createSlashCommand(execute),
        );
        const interaction = createInteraction();

        // Act
        await interactionListener(interaction);

        // Assert
        expect(execute).toHaveBeenCalledWith(interaction, expect.any(String));
      });

      it("should execute matching message command for message context interactions", async () => {
        // Arrange
        const execute = jest.fn().mockResolvedValue(undefined);
        (interactionHandler as any).messageContextMenuCommands.set(
          "ping",
          createCommand(execute) as MessageCommand,
        );
        const interaction = createInteraction({
          isChatInputCommand: jest.fn().mockReturnValue(false),
          isMessageContextMenuCommand: jest.fn().mockReturnValue(true),
        });

        // Act
        await interactionListener(interaction);

        // Assert
        expect(execute).toHaveBeenCalledWith(interaction, expect.any(String));
      });

      it("should execute matching user command for user context interactions", async () => {
        // Arrange
        const execute = jest.fn().mockResolvedValue(undefined);
        (interactionHandler as any).userContextMenuCommands.set(
          "ping",
          createCommand(execute) as UserCommand,
        );
        const interaction = createInteraction({
          isChatInputCommand: jest.fn().mockReturnValue(false),
          isUserContextMenuCommand: jest.fn().mockReturnValue(true),
        });

        // Act
        await interactionListener(interaction);

        // Assert
        expect(execute).toHaveBeenCalledWith(interaction, expect.any(String));
      });

      it("should execute matching subcommand for chat input interactions with subcommands", async () => {
        // Arrange
        const containerExecute = jest.fn().mockResolvedValue(undefined);
        const execute = jest.fn().mockResolvedValue(undefined);
        const subCommand = createCommand(execute, {
          getName: jest.fn().mockReturnValue("sub"),
        }) as unknown as SubCommand;
        (interactionHandler as any).slashCommands.set(
          "ping",
          createSlashCommand(execute, {
            getSubCommands: jest.fn().mockReturnValue([subCommand]),
          }),
        );
        const interaction = createInteraction({
          options: {
            getSubcommand: jest.fn().mockReturnValue("sub"),
          },
        });

        // Act
        await interactionListener(interaction);

        // Assert
        expect(execute).toHaveBeenCalledWith(interaction, expect.any(String));
        expect(containerExecute).not.toHaveBeenCalled();
      });

      it("should execute commands with user preferred locale when available", async () => {
        // Arrange
        const execute = jest.fn().mockResolvedValue(undefined);
        (interactionHandler as any).slashCommands.set(
          "ping",
          createSlashCommand(execute),
        );
        const interaction = createInteraction();
        (userRepositoryMock.getUserPreferredLanguage as jest.Mock)
          .mockResolvedValue({ code: Locale.French });

        // Act
        await interactionListener(interaction);

        // Assert
        expect(execute).toHaveBeenCalledWith(interaction, Locale.French);
      });

      it("should execute commands with interaction locale when no preferred locale exists", async () => {
        // Arrange
        const execute = jest.fn().mockResolvedValue(undefined);
        (interactionHandler as any).slashCommands.set(
          "ping",
          createSlashCommand(execute),
        );
        const interaction = createInteraction({ locale: Locale.EnglishUS });

        // Act
        await interactionListener(interaction);

        // Assert
        expect(execute).toHaveBeenCalledWith(interaction, Locale.EnglishUS);
      });

      it("should reply with an error when command execution fails", async () => {
        // Arrange
        const execute = jest.fn().mockRejectedValue(new Error("Execution failed"));
        (interactionHandler as any).slashCommands.set(
          "ping",
          createSlashCommand(execute),
        );
        const interaction = createInteraction() as unknown as CommandInteraction;
        interaction.replied = false;
        interaction.deferred = false;
        (userRepositoryMock.getUserPreferredLanguage as jest.Mock)
          .mockResolvedValue(undefined);

        // Act
        await interactionListener(interaction);

        // Assert
        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({
          content: "executionError",
        }));
      });

      it("should edit reply with an error when command execution fails after already been replied to", async () => {
        // Arrange
        const execute = jest.fn().mockRejectedValue(new Error("Execution failed"));
        (interactionHandler as any).slashCommands.set(
          "ping",
          createSlashCommand(execute),
        );
        const interaction = createInteraction() as unknown as CommandInteraction;
        interaction.replied = true;
        interaction.deferred = false;
        (userRepositoryMock.getUserPreferredLanguage as jest.Mock)
          .mockResolvedValue(undefined);

        // Act
        await interactionListener(interaction);

        // Assert
        expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({
          content: "executionError",
        }));
      });

      it("should reply with an error when a subcommand is requested but not found", async () => {
        // Arrange
        const containerExecute = jest.fn().mockResolvedValue(undefined);
        (interactionHandler as any).slashCommands.set(
          "ping",
          createSlashCommand(containerExecute, {
            getSubCommands: jest.fn().mockReturnValue([createCommand(jest.fn(), {
              getName: jest.fn().mockReturnValue("another-sub"),
            }) as unknown as SubCommand]),
          }),
        );
        const interaction = createInteraction({
          options: {
            getSubcommand: jest.fn().mockReturnValue("missing-sub"),
          },
        });

        // Act
        await interactionListener(interaction);

        // Assert
        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({
          content: "unknownCommand",
        }));
        expect(containerExecute).not.toHaveBeenCalled();
      });

      it("should reply with an error when a command has subcommands but the interaction does not specify one", async () => {
        // Arrange
        const containerExecute = jest.fn().mockResolvedValue(undefined);
        const execute = jest.fn().mockResolvedValue(undefined);
        (interactionHandler as any).slashCommands.set(
          "ping",
          createSlashCommand(containerExecute, {
            getSubCommands: jest.fn().mockReturnValue([
              createCommand(execute, {
                getName: jest.fn().mockReturnValue("sub"),
              }) as unknown as SubCommand,
            ]),
          }),
        );
        const interaction = createInteraction({
          options: {
            getSubcommand: jest.fn().mockImplementation(() => {
              throw new Error("No subcommand specified");
            }),
          },
        });

        // Act
        await interactionListener(interaction);

        // Assert
        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({
          content: "unknownCommand",
        }));
        expect(containerExecute).not.toHaveBeenCalled();
      });

      it("should reply with an error when the command is private and the user not an owner", async () => {
        // Arrange
        const execute = jest.fn().mockResolvedValue(undefined);
        (interactionHandler as any).slashCommands.set(
          "ping",
          createSlashCommand(execute, { isAdminOnly: true }),
        );
        const interaction = createInteraction();
        (userRepositoryMock.getUserPreferredLanguage as jest.Mock)
          .mockResolvedValue(undefined);

        // Act
        await interactionListener(interaction);

        // Assert
        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({
          content: "privateCommand",
        }));
      });

      it("should execute private commands for owners", async () => {
        // Arrange
        const ownerId = "owner-id";
        (interactionClientMock.getConfig as jest.Mock).mockReturnValue({
          ownerIds: [ownerId],
        });

        const execute = jest.fn().mockResolvedValue(undefined);
        (interactionHandler as any).slashCommands.set(
          "ping",
          createSlashCommand(execute, { isAdminOnly: true }),
        );
        const interaction = createInteraction({
          user: { id: ownerId },
        });
        (userRepositoryMock.getUserPreferredLanguage as jest.Mock)
          .mockResolvedValue(undefined);

        // Act
        await interactionListener(interaction);

        // Assert
        expect(execute).toHaveBeenCalledWith(interaction, expect.any(String));
      });

      it("should reply with an error when the user does not have permission to run the command", async () => {
        // Arrange
        const execute = jest.fn().mockResolvedValue(undefined);
        (interactionHandler as any).slashCommands.set(
          "ping",
          createSlashCommand(execute, {
            hasUserPermission: jest.fn().mockReturnValue(false),
          }),
        );
        const interaction = createInteraction();
        (userRepositoryMock.getUserPreferredLanguage as jest.Mock)
          .mockResolvedValue(undefined);

        // Act
        await interactionListener(interaction);

        // Assert
        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({
          content: "missingPermission.user",
        }));
      });

      it("should reply with an error when the bot does not have permission to run the command", async () => {
        // Arrange
        const execute = jest.fn().mockResolvedValue(undefined);
        (interactionHandler as any).slashCommands.set(
          "ping",
          createSlashCommand(execute, {
            hasBotPermission: jest.fn().mockReturnValue(false),
          }),
        );
        const interaction = createInteraction();
        (userRepositoryMock.getUserPreferredLanguage as jest.Mock)
          .mockResolvedValue(undefined);

        // Act
        await interactionListener(interaction);

        // Assert
        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({
          content: "missingPermission.bot",
        }));
      });
    });
  });

  describe("registerCommands", () => {
    it("should throw when the client is not set", async () => {
      // Act
      const result = handler.registerCommands("token");
      // Assert
      await expect(result).rejects.toThrow();
    });

    it("should throw when the client is not ready", async () => {
      // Arrange
      (clientMock as any).isReady = jest.fn().mockReturnValue(false);
      handler.setClient(clientMock);

      // Act
      const result = handler.registerCommands("token");

      // Assert
      await expect(result).rejects.toThrow(
        "The client must be ready to register commands.",
      );
    });

    it("should refresh global commands", async () => {
      // Arrange
      handler.setClient(clientMock);
      jest.spyOn(handler, "getAllCommands").mockReturnValue(new Map([
        ["ping", {
          getData: jest.fn().mockReturnValue({ name: "ping" }),
        } as unknown as BaseCommand],
      ]));

      // Act
      await handler.registerCommands("token");

      // Assert
      expect(restMock.setToken).toHaveBeenCalledWith("token");
      expect(Routes.applicationCommands).toHaveBeenCalledWith("bot-id");
      expect(restMock.put).toHaveBeenCalledWith("global-route", {
        body: [{ name: "ping" }],
      });
    });

    it("should refresh guild commands when a guild id is provided", async () => {
      // Arrange
      handler.setClient(clientMock);
      jest.spyOn(handler, "getAllCommands").mockReturnValue(new Map([
        ["ping", {
          getData: jest.fn().mockReturnValue({ name: "ping" }),
        } as unknown as BaseCommand],
      ]));

      // Act
      await handler.registerCommands("token", "guild-id");

      // Assert
      expect(Routes.applicationGuildCommands).toHaveBeenCalledWith(
        "bot-id",
        "guild-id",
      );
      expect(restMock.put).toHaveBeenCalledWith("guild-route", {
        body: [{ name: "ping" }],
      });
    });

    it("should not exit systme if command registration fails", async () => {
      // Arrange
      handler.setClient(clientMock);
      jest.spyOn(handler, "getAllCommands").mockReturnValue(new Map());
      restMock.put.mockRejectedValue(new Error("Registration failed"));

      // Act
      const result = handler.registerCommands("token");

      // Assert
      await expect(result).resolves.toBeUndefined();
    });
  });

  describe("getAllCommands", () => {
    it("should return an empty map if no commands are registered", () => {
      // Act
      const result = handler.getAllCommands();

      // Assert
      expect(result.size).toBe(0);
    });

    it("should merge the three command collections", () => {
      // Arrange
      const messageCommand = {} as BaseCommand;
      const userCommand = {} as BaseCommand;
      const slashCommand = {} as BaseCommand;
      (handler as any).messageContextMenuCommands.set("message", messageCommand);
      (handler as any).userContextMenuCommands.set("user", userCommand);
      (handler as any).slashCommands.set("slash", slashCommand);

      // Act
      const result = handler.getAllCommands();

      // Assert
      expect(Array.from(result.keys())).toEqual(["message", "user", "slash"]);
      expect(result.get("message")).toBe(messageCommand);
      expect(result.get("user")).toBe(userCommand);
      expect(result.get("slash")).toBe(slashCommand);
    });

    it("should give precedence to slash commands in case of name conflicts", () => {
      // Arrange
      const messageCommand = {} as BaseCommand;
      const userCommand = {} as BaseCommand;
      const slashCommand = {} as BaseCommand;
      (handler as any).messageContextMenuCommands.set("test", messageCommand);
      (handler as any).userContextMenuCommands.set("test", userCommand);
      (handler as any).slashCommands.set("test", slashCommand);

      // Act
      const result = handler.getAllCommands();

      // Assert
      expect(result.get("test")).toBe(slashCommand);
    });
  });
});
