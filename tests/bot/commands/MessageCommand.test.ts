import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type { Locale, MessageContextMenuCommandInteraction } from "discord.js";
import { MessageCommand } from "@bot/commands/MessageCommand";
import {
  ApplicationCommandType,
  ApplicationIntegrationType,
} from "discord.js";

class TestMessageCommand extends MessageCommand {
  protected readonly data = {
    name: "test-message",
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
    const clientMock = {} as Tickly;
    command = new TestMessageCommand(
      clientMock,
      {} as TodoistApiClient,
      {} as RepositoryFactory,
    );
  });

  it("should have the Message type", () => {
    // Act
    const result = (command as any).type;

    // Assert
    expect(result).toBe(ApplicationCommandType.Message);
  });

  it("should not include description fields in command data", () => {
    // Act
    const result = command.getData();

    // Assert
    expect(result.description).toBeUndefined();
    expect((result as any).description_localizations).toBeUndefined();
  });
});
