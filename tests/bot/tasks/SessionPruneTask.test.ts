import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import { SessionPruneTask } from "@bot/tasks/SessionPruneTask";
import * as nodeCron from "node-cron";

jest.mock("node-cron", () => ({
  schedule: jest.fn(),
}));

let task: SessionPruneTask;
let mockTodoistClient: jest.Mocked<Pick<TodoistApiClient, "pruneExpiredSessions">>;

beforeEach(() => {
  jest.clearAllMocks();
  mockTodoistClient = {
    pruneExpiredSessions: jest.fn().mockResolvedValue(undefined),
  };
  task = new SessionPruneTask(mockTodoistClient as unknown as TodoistApiClient);
});

describe("SessionPruneTask", () => {
  describe("start", () => {
    it("should register a cron job with a daily 3 AM UTC expression", () => {
      // Act
      task.start();

      // Assert
      expect(nodeCron.schedule).toHaveBeenCalledWith(
        "0 3 * * *",
        expect.any(Function),
        expect.objectContaining({ name: "session-prune" }),
      );
    });

    it("should register exactly one cron job", () => {
      // Act
      task.start();

      // Assert
      expect(nodeCron.schedule).toHaveBeenCalledTimes(1);
    });
  });

  describe("run", () => {
    it("should call pruneExpiredSessions on the todoist client", async () => {
      // Act
      await (task as any).run();

      // Assert
      expect(mockTodoistClient.pruneExpiredSessions).toHaveBeenCalledTimes(1);
    });

    it("should not throw when pruneExpiredSessions fails", async () => {
      // Arrange
      mockTodoistClient.pruneExpiredSessions = jest.fn().mockRejectedValue(
        new Error("DB connection lost"),
      );

      // Act & Assert
      await expect((task as any).run()).resolves.toBeUndefined();
    });
  });
});
