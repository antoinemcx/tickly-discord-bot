/** Error thrown when a Discord DM cannot be delivered because the recipient has DMs disabled. */
export class DmDisabledError extends Error {
  public readonly userId: string;

  constructor(userId: string) {
    super(`Cannot send DM to user ${userId}: DMs are disabled.`);
    this.name = "DmDisabledError";
    this.userId = userId;
  }
}

/** Error thrown when a Discord user cannot be found by the given ID. */
export class UserNotFoundError extends Error {
  public readonly userId: string;

  constructor(userId: string) {
    super(`Cannot send DM to user ${userId}: user not found.`);
    this.name = "UserNotFoundError";
    this.userId = userId;
  }
}
