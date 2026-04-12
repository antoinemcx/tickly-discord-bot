import type { Tickly } from "@bot/Tickly";

export abstract class Handler {
  protected client: Tickly | null = null;

  /**
   * Inject the bot instance so the handler can access the client and
   * its business repositories.
   * @param client the bot instance that will be used by this handler
   */
  public setClient(client: Tickly): void {
    this.client = client;
  }

  /**
   * Initialize and load this handler (load commands, bind events, etc).
   * @throws {Error} if the client is not set yet for this handler
   */
  public async setup(): Promise<void> {
    if (!this.client) {
      throw new Error("The client is not set for handler.");
    }
    // To be implemented by subclasses
  }
}
