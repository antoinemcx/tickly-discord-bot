import type { TranslationHandler } from "@bot/handlers/TranslationHandler";
import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type {
  APIApplicationCommand,
  BaseInteraction,
} from "discord.js";
import { RegisterableBaseCommand } from "@bot/commands/core/RegisterableBaseCommand";
import {
  ApplicationCommandType,
  ApplicationIntegrationType,
  InteractionContextType,
  Locale,
} from "discord.js";

class TestCommand extends RegisterableBaseCommand {
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

describe("RegisterableBaseCommand", () => {
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

    it("should include default integration types and contexts if not provided", () => {
      // Arrange
      class NoIntegrationCommand extends RegisterableBaseCommand {
        protected readonly type: APIApplicationCommand["type"]
          = ApplicationCommandType.ChatInput;

        protected readonly data = {
          name: "no-integration",
          description: "No integration types or contexts",
        };

        public async execute(
          _interaction: BaseInteraction,
          _language: Locale,
        ): Promise<void> { /* empty body */ }
      }
      const noIntegrationCommand = new NoIntegrationCommand(
        clientMock,
        todoistClientMock,
        repositoriesMock,
      );

      // Act
      const data = noIntegrationCommand.getData();

      // Assert
      expect(data.integration_types).toEqual([
        ApplicationIntegrationType.GuildInstall,
        ApplicationIntegrationType.UserInstall,
      ]);
      expect(data.contexts).toEqual([
        InteractionContextType.Guild,
        InteractionContextType.BotDM,
        InteractionContextType.PrivateChannel,
      ]);
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
