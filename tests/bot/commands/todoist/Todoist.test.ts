import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import Todoist from "@bot/commands/todoist/Todoist";

describe("Todoist", () => {
  let command: Todoist;

  beforeEach(() => {
    // Arrange
    const clientMock = {
      getTranslationHandler: jest.fn().mockReturnValue({
        translateCommon: jest.fn(),
      }),
      getConfig: jest.fn().mockReturnValue({
        emotes: { priorities: { 1: "p1", 2: "p2", 3: "p3", 4: "p4" } },
      }),
    } as unknown as Tickly;

    command = new Todoist(
      clientMock,
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
