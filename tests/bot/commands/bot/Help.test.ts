import type { SubCommand } from "@bot/commands/core/SubCommand";
import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import Help from "@bot/commands/bot/Help";
import { SlashCommand } from "@bot/commands/core/SlashCommand";
import { Locale, MessageFlags } from "discord.js";

describe("Help Command", () => {
  const language = Locale.EnglishUS;
  let command: Help;
  let clientMock: Tickly;
  let todoistClientMock: TodoistApiClient;
  let repositoriesMock: RepositoryFactory;

  beforeEach(() => {
    clientMock = {
      getTranslationHandler: jest.fn().mockReturnValue({
        translateCommand: (_lang: Locale, _cmd: string, key: string) => key,
        getDefaultLocale: jest.fn().mockReturnValue(Locale.EnglishUS),
        getCommandDescriptions: jest.fn().mockReturnValue({}),
      }),
      getCommandMention: jest.fn().mockResolvedValue("/dummy"),
      getSlashCommandByName: jest.fn(),
      getSlashCommands: jest.fn().mockReturnValue(new Map()),
      getConfig: jest.fn().mockReturnValue({
        ownerIds: [],
        links: {
          github: "https://github.com",
          supportServer: "https://discord.gg",
          roadmap: "https://example.com/roadmap",
        },
      }),
      getInviteLink: jest.fn().mockReturnValue("https://discord.com/invite"),
    } as unknown as Tickly;
    todoistClientMock = {} as TodoistApiClient;
    repositoriesMock = {} as RepositoryFactory;

    command = new Help(clientMock, todoistClientMock, repositoriesMock);
  });

  describe("message component handlers", () => {
    it("should register a handler for each button action", () => {
      // Act
      const handlers = command.getMessageComponentHandlers();

      // Assert
      expect(handlers.size).toBe(2);
      expect(handlers.has("help:start_guide")).toBe(true);
      expect(handlers.has("help:back_to_commands")).toBe(true);
    });

    it("should edit the message when the interaction is not ephemeral", async () => {
      // Arrange
      const handlers = command.getMessageComponentHandlers();
      const interaction = {
        user: { id: "123" },
        message: {
          flags: { has: jest.fn().mockReturnValue(false) },
          edit: jest.fn().mockResolvedValue(undefined),
        },
        reply: jest.fn(),
        editReply: jest.fn(),
        replied: false,
        deferred: false,
      } as any;

      // Act
      await handlers.get("help:start_guide")!(interaction, language);

      // Assert
      expect(interaction.message.edit).toHaveBeenCalled();
      expect(interaction.reply).not.toHaveBeenCalled();
    });

    it("should reply to the interaction when the message is ephemeral", async () => {
      // Arrange
      const handlers = command.getMessageComponentHandlers();
      const interaction = {
        user: { id: "123" },
        message: {
          flags: { has: jest.fn().mockReturnValue(true) },
          edit: jest.fn(),
        },
        reply: jest.fn().mockResolvedValue(undefined),
        editReply: jest.fn(),
        replied: false,
        deferred: false,
      } as any;

      // Act
      await handlers.get("help:back_to_commands")!(interaction, language);

      // Assert
      expect(interaction.reply).toHaveBeenCalled();
      expect(interaction.message.edit).not.toHaveBeenCalled();
    });
  });

  describe("execute", () => {
    function buildInteraction(overrides: Record<string, any> = {}) {
      return {
        user: { id: "123" },
        options: {
          getString: jest.fn().mockReturnValue(null),
          getBoolean: jest.fn().mockReturnValue(null),
        },
        deferReply: jest.fn().mockResolvedValue(undefined),
        editReply: jest.fn().mockResolvedValue(undefined),
        ...overrides,
      } as any;
    }

    it("should defer with ephemeral flag when ephemeral option is true", async () => {
      // Arrange
      const interaction = buildInteraction();
      interaction.options.getBoolean.mockReturnValue(true);

      // Act
      await command.execute(interaction, language);

      // Assert
      expect(interaction.deferReply).toHaveBeenCalledWith({
        flags: MessageFlags.Ephemeral,
      });
    });

    it("should defer without flags when ephemeral option is not set", async () => {
      // Arrange
      const interaction = buildInteraction();

      // Act
      await command.execute(interaction, language);

      // Assert
      expect(interaction.deferReply).toHaveBeenCalledWith({
        flags: undefined,
      });
    });

    it("should display command details when a command name is provided", async () => {
      // Arrange
      const interaction = buildInteraction();
      interaction.options.getString.mockReturnValue("ping");

      const pingCommand = {
        getName: jest.fn().mockReturnValue("ping"),
        getData: jest.fn().mockReturnValue({
          description: "Pong!",
          description_localizations: { [Locale.EnglishUS]: "Pong!" },
        }),
        isAdminOnly: false,
        userRequiredPermissions: [],
        clientRequiredPermissions: [],
        getSubCommands: jest.fn().mockReturnValue([]),
        getCategory: jest.fn().mockReturnValue("Bot"),
        getParentCommandCategory: jest.fn().mockReturnValue("Bot"),
      };
      (clientMock.getSlashCommandByName as jest.Mock).mockReturnValue(pingCommand);

      // Act
      await command.execute(interaction, language);

      // Assert
      const editArg = (interaction.editReply as jest.Mock).mock.calls[0][0];
      expect(editArg.embeds[0].title).toContain("ping");
    });

    it("should display subcommand details when a subcommand name is provided", async () => {
      // Arrange
      const interaction = buildInteraction();
      interaction.options.getString.mockReturnValue("todoist login");

      const loginSubCommand = {
        getName: jest.fn().mockReturnValue("login"),
        getData: jest.fn().mockReturnValue({
          description: "Login to Todoist",
          description_localizations: { [Locale.EnglishUS]: "Login to Todoist" },
        }),
        isAdminOnly: false,
        userRequiredPermissions: [],
        clientRequiredPermissions: [],
        getParentCommandCategory: jest.fn().mockReturnValue("Todoist"),
      } as unknown as SubCommand;

      const todoistCommand = {
        getName: jest.fn().mockReturnValue("todoist"),
        getSubCommands: jest.fn().mockReturnValue([loginSubCommand]),
        getCategory: jest.fn().mockReturnValue("Todoist"),
      };
      (clientMock.getSlashCommandByName as jest.Mock).mockReturnValue(todoistCommand);

      // Act
      await command.execute(interaction, language);

      // Assert
      const editArg = (interaction.editReply as jest.Mock).mock.calls[0][0];
      expect(editArg.embeds[0].title).toContain("login");
    });

    it("should list subcommands when a parent command with subcommands is requested", async () => {
      // Arrange
      const interaction = buildInteraction();
      interaction.options.getString.mockReturnValue("todoist");

      const loginSub = {
        getName: jest.fn().mockReturnValue("login"),
        getData: jest.fn().mockReturnValue({
          description: "Login",
          description_localizations: { [Locale.EnglishUS]: "Login" },
        }),
        isAdminOnly: false,
        userRequiredPermissions: [],
        clientRequiredPermissions: [],
      } as unknown as SubCommand;
      const addSub = {
        getName: jest.fn().mockReturnValue("add"),
        getData: jest.fn().mockReturnValue({
          description: "Add task",
          description_localizations: { [Locale.EnglishUS]: "Add task" },
        }),
        isAdminOnly: false,
        userRequiredPermissions: [],
        clientRequiredPermissions: [],
      } as unknown as SubCommand;

      const todoistCommand = Object.assign(Object.create(SlashCommand.prototype), {
        getName: jest.fn().mockReturnValue("todoist"),
        getData: jest.fn().mockReturnValue({
          description: "Todoist commands",
          description_localizations: { [Locale.EnglishUS]: "Todoist commands" },
        }),
        isAdminOnly: false,
        userRequiredPermissions: [],
        clientRequiredPermissions: [],
        getSubCommands: jest.fn().mockReturnValue([loginSub, addSub]),
        getCategory: jest.fn().mockReturnValue("Todoist"),
        getParentCommandCategory: jest.fn().mockReturnValue("Todoist"),
      });
      (clientMock.getSlashCommandByName as jest.Mock).mockReturnValue(todoistCommand);

      // Act
      await command.execute(interaction, language);

      // Assert
      const editArg = (interaction.editReply as jest.Mock).mock.calls[0][0];
      expect(editArg.embeds[0].title).toContain("todoist");
      const subcommandsField = editArg.embeds[0].fields.find(
        (f: any) => f.value.includes("login") && f.value.includes("add"),
      );
      expect(subcommandsField).toBeDefined();
    });

    it("should send a command list response when no command name is provided", async () => {
      // Arrange
      const interaction = buildInteraction();

      // Act
      await command.execute(interaction, language);

      // Assert
      expect(interaction.editReply).toHaveBeenCalled();
      const editArg = (interaction.editReply as jest.Mock).mock.calls[0][0];
      expect(editArg.flags).toBe(MessageFlags.IsComponentsV2);
      expect(editArg.components).toBeDefined();
    });

    it("should include a start guide button in the command list response", async () => {
      // Arrange
      const interaction = buildInteraction();

      // Act
      await command.execute(interaction, language);

      // Assert
      const editArg = (interaction.editReply as jest.Mock).mock.calls[0][0];
      const container = editArg.components[0];
      const containerJson = typeof container.toJSON === "function"
        ? container.toJSON()
        : container;
      const allComponents = JSON.stringify(containerJson);
      expect(allComponents).toContain("help:start_guide");
    });
  });
});
