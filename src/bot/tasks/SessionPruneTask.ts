import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import { displayDetailedError, displayInfo, displaySuccess } from "@src/utils/logger";
import { schedule } from "node-cron";

/**
 * Scheduled task that prunes expired OAuth sessions and inactive completed
 * sessions from the database once a day at 3 AM UTC.
 */
export class SessionPruneTask {
  /** Runs every day at 3 AM UTC */
  private static readonly CRON_EXPRESSION = "0 3 * * *";

  public constructor(private readonly todoistClient: TodoistApiClient) {}

  /**
   * Registers the prune task.
   * The task will fire every day at 3 AM UTC.
   */
  public start(): void {
    displayInfo(`Session prune scheduled (${SessionPruneTask.CRON_EXPRESSION}).`);
    schedule(
      SessionPruneTask.CRON_EXPRESSION,
      () => this.run(),
      { name: "session-prune" },
    );
  }

  /**
   * Executes the prune operation. Errors are caught and logged so a
   * transient DB failure does not crash the scheduler.
   */
  private async run(): Promise<void> {
    try {
      await this.todoistClient.pruneExpiredSessions();
      displaySuccess("Session prune completed successfully.");
    } catch (error) {
      displayDetailedError("Session prune failed.", error);
    }
  }
}
