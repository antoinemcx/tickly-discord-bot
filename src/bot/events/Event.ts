import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type { ClientEvents, Events } from "discord.js";

/**
 * Abstract representation of a discord event.
 * @template E the type of the client event
 */
export abstract class Event<
  E extends Extract<Events, keyof ClientEvents> = Extract<Events, keyof ClientEvents>,
> {
  /** The name of the event. */
  public abstract name: E;
  /** Whether the event should be listened to only once. */
  public once?: boolean;

  /**
   * Constructs and initializes a new discord event.
   * @param client discord client currently running
   * @param todoistClient todoist client currently running
   * @param repositories repositories factory to access the database
   */
  constructor(
    protected client: Tickly,
    protected todoistClient: TodoistApiClient,
    protected repositories: RepositoryFactory,
  ) {}

  /**
   * Executes the event's behavior.
   * @param args event's arguments included by discord.
   */
  public abstract execute(...args: ClientEvents[E]): Promise<void>;
}
