import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type { UserContextMenuCommandInteraction } from "discord.js";
import { UserCommand } from "@bot/commands/core/UserCommand";
import { ApplicationCommandType, ApplicationIntegrationType, Locale } from "discord.js";

class TestUserCommand extends UserCommand {
  protected readonly translationName = "test-user";
  protected readonly data = {
    integration_types: [ApplicationIntegrationType.GuildInstall],
  };

  public async execute(
    _interaction: UserContextMenuCommandInteraction,
    _language: Locale,
  ): Promise<void> { /* empty body */ }
}

describe("UserCommand", () => {
  let command: TestUserCommand;

  beforeEach(() => {
    // Arrange
    const clientMock = {
      getTranslationHandler: () => ({
        getDefaultLocale: () => Locale.EnglishUS,
        translateCommand: jest.fn().mockReturnValue("Test Command"),
        getCommandNames: jest.fn().mockReturnValue({
          [Locale.EnglishUS]: "Test User Command",
        }),
      }),
    } as unknown as Tickly;
    command = new TestUserCommand(
      clientMock,
      {} as TodoistApiClient,
      {} as RepositoryFactory,
    );
  });

  it("should have the User type", () => {
    // Act
    const result = command.getData();

    // Assert
    expect(result.type).toBe(ApplicationCommandType.User);
  });
});
