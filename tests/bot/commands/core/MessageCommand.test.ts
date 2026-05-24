import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type { MessageContextMenuCommandInteraction } from "discord.js";
import { MessageCommand } from "@bot/commands/core/MessageCommand";
import { ApplicationCommandType, ApplicationIntegrationType, Locale } from "discord.js";

class TestMessageCommand extends MessageCommand {
  protected readonly translationName = "test-message";
  protected readonly data = {
    integration_types: [ApplicationIntegrationType.GuildInstall],
  };

  public async execute(
    _interaction: MessageContextMenuCommandInteraction,
    _language: Locale,
  ): Promise<void> { /* empty body */ }
}

describe("MessageCommand", () => {
  let command: TestMessageCommand;

  beforeEach(() => {
    // Arrange
    const clientMock = {
      getTranslationHandler: () => ({
        getDefaultLocale: () => Locale.EnglishUS,
        translateCommand: jest.fn().mockReturnValue("Test Command"),
        getCommandNames: jest.fn().mockReturnValue({
          [Locale.EnglishUS]: "Test Message Command",
        }),
      }),
    } as unknown as Tickly;
    command = new TestMessageCommand(
      clientMock,
      {} as TodoistApiClient,
      {} as RepositoryFactory,
    );
  });

  it("should have the Message type", () => {
    // Act
    const result = command.getData();

    // Assert
    expect(result.type).toBe(ApplicationCommandType.Message);
  });
});
