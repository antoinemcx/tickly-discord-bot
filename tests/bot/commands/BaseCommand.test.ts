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

  describe("getData", () => {
    it("should return command data with type", () => {
      // Act
      const data = command.getData();

      // Assert
      expect(data).toEqual(expect.objectContaining({
        name: "test",
        description: "test description",
        type: ApplicationCommandType.ChatInput,
      }));
    });
  });

  describe("getName", () => {
    it("should return command name", () => {
      // Act
      const name = command.getName();
      // Assert
      expect(name).toBe("test");
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
  });
});
