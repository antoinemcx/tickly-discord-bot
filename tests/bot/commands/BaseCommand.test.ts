import type { CommandData } from "@bot/commands/BaseCommand";
import type { TranslationHandler } from "@bot/handlers/TranslationHandler";
import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type {
  APIApplicationCommand,
  BaseInteraction,
} from "discord.js";
import { BaseCommand } from "@bot/commands/BaseCommand";
import { ApplicationCommandType, ApplicationIntegrationType, Locale } from "discord.js";

class TestCommand extends BaseCommand {
  protected readonly type: APIApplicationCommand["type"]
    = ApplicationCommandType.ChatInput;

  protected readonly data = {
    name: "test",
    description: "test description",
    integration_types: [ApplicationIntegrationType.GuildInstall],
  };

  public async execute(
    _interaction: BaseInteraction,
    _language: Locale,
  ): Promise<void> { /* empty body */ }

  public getData(): (CommandData & { type: APIApplicationCommand["type"] }) {
    return {} as (CommandData & { type: APIApplicationCommand["type"] });
  }
}

describe("BaseCommand", () => {
  let command: TestCommand;
  let clientMock: Tickly;
  let translationHandlerMock: TranslationHandler;
  let todoistClientMock: TodoistApiClient;
  let repositoriesMock: RepositoryFactory;

  beforeEach(() => {
    // Arrange
    translationHandlerMock = {
      translateCommand: jest.fn().mockReturnValue("translated text"),
    } as unknown as TranslationHandler;
    clientMock = {
      getTranslationHandler: jest.fn().mockReturnValue(translationHandlerMock),
    } as unknown as Tickly;
    todoistClientMock = {} as TodoistApiClient;
    repositoriesMock = {
      getLanguageRepository: jest.fn(),
      getUserRepository: jest.fn(),
      getUserSessionRepository: jest.fn(),
    } as unknown as RepositoryFactory;

    command = new TestCommand(
      clientMock,
      todoistClientMock,
      repositoriesMock,
    );
  });

  it("should have no userRequiredPermissions by default", () => {
    expect(command.userRequiredPermissions).toEqual([]);
  });

  it("should have no clientRequiredPermissions by default", () => {
    expect(command.clientRequiredPermissions).toEqual([]);
  });

  describe("getName", () => {
    it("should return command name", () => {
      // Act
      const name = command.getName();
      // Assert
      expect(name).toBe("test");
    });

    it("should return empty string if name is not defined", () => {
      // Arrange
      class NamelessCommand extends BaseCommand {
        protected readonly type = ApplicationCommandType.ChatInput;
        protected readonly data = {};

        public async execute(
          _interaction: BaseInteraction,
          _language: Locale,
        ): Promise<void> { /* empty body */ }

        public getData(): CommandData & { type: APIApplicationCommand["type"] } {
          return {} as CommandData & { type: APIApplicationCommand["type"] };
        }
      }
      const namelessCommand = new NamelessCommand(
        clientMock,
        todoistClientMock,
        repositoriesMock,
      );

      // Act
      const name = namelessCommand.getName();

      // Assert
      expect(name).toBe("");
    });
  });

  describe("hasUserPermission", () => {
    it("should return true when no permissions are required", () => {
      // Arrange
      const interaction = {} as BaseInteraction;
      // Act
      const result = command.hasUserPermission(interaction);
      // Assert
      expect(result).toBe(true);
    });

    it("should return true when member has required permissions", () => {
      // Arrange
      ((command as any).userRequiredPermissions as string[]).push("ManageMessages");
      const interaction = {
        memberPermissions: { has: jest.fn().mockReturnValue(true) },
      } as unknown as BaseInteraction;

      // Act
      const result = command.hasUserPermission(interaction);

      // Assert
      expect(result).toBe(true);
      expect(interaction.memberPermissions?.has)
        .toHaveBeenCalledWith(["ManageMessages"]);
    });

    it("should return false when member does not have required permissions", () => {
      // Arrange
      ((command as any).userRequiredPermissions as string[]).push("ManageMessages");
      const interaction = {
        memberPermissions: { has: jest.fn().mockReturnValue(false) },
      } as unknown as BaseInteraction;

      // Act
      const result = command.hasUserPermission(interaction);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe("hasBotPermission", () => {
    it("should return true when no permissions are required", () => {
      // Arrange
      const interaction = {
        appPermissions: { has: jest.fn() },
      } as unknown as BaseInteraction;

      // Act
      const result = command.hasBotPermission(interaction);

      // Assert
      expect(result).toBe(true);
    });

    it("should return true when bot has required permissions", () => {
      // Arrange
      ((command as any).clientRequiredPermissions as string[]).push("ManageMessages");
      const interaction = {
        appPermissions: { has: jest.fn().mockReturnValue(true) },
      } as unknown as BaseInteraction;

      // Act
      const result = command.hasBotPermission(interaction);

      // Assert
      expect(result).toBe(true);
      expect(interaction.appPermissions.has)
        .toHaveBeenCalledWith(["ManageMessages"]);
    });

    it("should return false when bot does not have required permissions", () => {
      // Arrange
      ((command as any).clientRequiredPermissions as string[]).push("ManageMessages");
      const interaction = {
        appPermissions: { has: jest.fn().mockReturnValue(false) },
      } as unknown as BaseInteraction;

      // Act
      const result = command.hasBotPermission(interaction);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe("isUserInstalled", () => {
    it("should return true when the interaction has a user installation owner", () => {
      // Arrange
      const interaction = {
        authorizingIntegrationOwners: {
          [ApplicationIntegrationType.UserInstall]: "123456789012345678",
        },
      } as unknown as BaseInteraction;

      // Act
      const result = command.isUserInstalled(interaction);

      // Assert
      expect(result).toBe(true);
    });

    it("should return false when the interaction has no user installation owner", () => {
      // Arrange
      const interaction = {
        authorizingIntegrationOwners: {},
      } as unknown as BaseInteraction;

      // Act
      const result = command.isUserInstalled(interaction);

      // Assert
      expect(result).toBe(false);
    });

    it("should return false when the interaction has only a guild installation", () => {
      // Arrange
      const interaction = {
        authorizingIntegrationOwners: {
          [ApplicationIntegrationType.GuildInstall]: "123456789012345678",
        },
      } as unknown as BaseInteraction;

      // Act
      const result = command.isUserInstalled(interaction);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe("translate", () => {
    it("should delegate to translation handler", () => {
      // Act
      const translated = (command as any).translate(
        Locale.EnglishUS,
        "my.key",
        { name: "Tickly" },
      );

      // Assert
      expect(translated).toBe("translated text");
      expect(clientMock.getTranslationHandler).toHaveBeenCalled();
      expect(translationHandlerMock.translateCommand).toHaveBeenCalledWith(
        "en-US",
        "test",
        "my.key",
        { name: "Tickly" },
      );
    });

    it("should use getTranslationCommandName for the translation key", () => {
      // Arrange
      class CustomCommand extends BaseCommand {
        protected readonly type = ApplicationCommandType.ChatInput;
        protected readonly data = { name: "custom", description: "desc" };
        protected getTranslationCommandName(): string {
          return "custom_command.child";
        }

        public async execute(
          _interaction: BaseInteraction,
          _language: Locale,
        ): Promise<void> { /* empty body */ }

        public getData(): CommandData & { type: APIApplicationCommand["type"] } {
          return {} as CommandData & { type: APIApplicationCommand["type"] };
        }
      }
      const customCommand = new CustomCommand(
        clientMock,
        todoistClientMock,
        repositoriesMock,
      );

      // Act
      (customCommand as any).translate(Locale.EnglishUS, "key");

      // Assert
      expect(translationHandlerMock.translateCommand).toHaveBeenCalledWith(
        "en-US",
        "custom_command.child",
        "key",
        {},
      );
    });
  });

  describe("buildComponentId", () => {
    it("should build a customId with the command name prefix", () => {
      // Act
      const id = (command as any).buildComponentId("my_action");
      // Assert
      expect(id).toBe("test:my_action");
    });
  });

  describe("onMessageComponent", () => {
    it("should register a handler accessible", () => {
      // Arrange
      const handler = jest.fn();
      // Act
      (command as any).onMessageComponent("action", handler);
      // Assert
      expect(command.getMessageComponentHandlers().get("test:action")).toBe(handler);
    });

    it("should return an empty map when no handlers are registered", () => {
      // Act
      const handlers = command.getMessageComponentHandlers();
      // Assert
      expect(handlers.size).toBe(0);
    });

    it("should support multiple handlers for different actions", () => {
      // Arrange
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      // Act
      (command as any).onMessageComponent("first", handler1);
      (command as any).onMessageComponent("second", handler2);
      // Assert
      expect(command.getMessageComponentHandlers().size).toBe(2);
      expect(command.getMessageComponentHandlers().get("test:first")).toBe(handler1);
      expect(command.getMessageComponentHandlers().get("test:second")).toBe(handler2);
    });
  });
});
