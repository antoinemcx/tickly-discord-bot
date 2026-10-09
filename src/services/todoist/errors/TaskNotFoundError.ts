/**
 * Error thrown when a Todoist task cannot be found (HTTP 404).
 * This typically occurs when a task has been deleted between the time
 * it was referenced and when an operation is attempted.
 */
export class TaskNotFoundError extends Error {
  public readonly taskId: string;

  constructor(taskId: string) {
    super(`Task '${taskId}' not found. It may have been deleted.`);
    this.name = "TaskNotFoundError";
    this.taskId = taskId;
  }
}
