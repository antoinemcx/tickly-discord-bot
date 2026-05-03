import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import Todoist from "@bot/commands/todoist/Todoist";

describe("Todoist", () => {
  let command: Todoist;

  beforeEach(() => {
    // Arrange
    command = new Todoist(
      {} as Tickly,
      {} as TodoistApiClient,
      {} as RepositoryFactory,
    );
  });

  it("should have the correct name", () => {
    // Act
    const result = command.getName();
    // Assert
    expect(result).toBe("todoist");
  });

  it("should have subcommands", () => {
    // Act
    const result = command.getSubCommands();
    // Assert
    expect(result).toBeDefined();
    expect(result?.length).toBeGreaterThan(0);
  });
});
