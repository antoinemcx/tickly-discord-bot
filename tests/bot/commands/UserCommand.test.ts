import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type { Locale, UserContextMenuCommandInteraction } from "discord.js";
import { UserCommand } from "@bot/commands/UserCommand";
import {
  ApplicationCommandType,
  ApplicationIntegrationType,
} from "discord.js";

class TestUserCommand extends UserCommand {
  protected readonly data = {
    name: "test-user",
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
    const clientMock = {} as Tickly;
    command = new TestUserCommand(
      clientMock,
      {} as TodoistApiClient,
      {} as RepositoryFactory,
    );
  });

  it("should have the User type", () => {
    // Act
    const result = (command as any).type;

    // Assert
    expect(result).toBe(ApplicationCommandType.User);
  });

  it("should not include description fields in command data", () => {
    // Act
    const result = command.getData();

    // Assert
    expect(result.description).toBeUndefined();
    expect((result as any).description_localizations).toBeUndefined();
  });
});
