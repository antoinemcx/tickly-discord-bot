import type { Event } from "@bot/events/Event";
import type { Tickly } from "@bot/Tickly";
import type { RepositoryFactory } from "@database/repositories/RepositoryFactory";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { displayInfo, displaySuccess, displayWarning, pink } from "@src/utils/logger";
import { Handler } from "./Handler";

export class EventHandler extends Handler {
  public static readonly eventsDirectory = join(__dirname, "..", "events");

  /**
   * Initialize this with empty state. You must call setClient() and setup()
   * to load the events.
   * @param todoistClient the Todoist client all the commands will use
   * @param repositories the repository factory all the commands will use
   */
  constructor(
    private readonly todoistClient: TodoistApiClient,
    private readonly repositories: RepositoryFactory,
  ) {
    super();
  }

  public async setup(): Promise<void> {
    if (!this.client) {
      throw new Error("The client is not set for handler.");
    }

    await this.loadEvents();
    this.loadErrorEvents();
  }

  /**
   * Loads all events from the file system.
   * @returns a promise that resolves when the events are loaded
   */
  private async loadEvents(): Promise<void> {
    let eventsLoaded = 0;

    try {
      const files = readdirSync(EventHandler.eventsDirectory);
      displayInfo("Loading events...");

      for (const file of files) {
        const filePath = join(EventHandler.eventsDirectory, file);

        if (statSync(filePath).isFile()) {
          const module = await import(filePath);
          if (module.default) {
            this.bindEvent(module.default);
            eventsLoaded++;
          } // else class is missing the default export, ignore
        }
      }
      displaySuccess(`${pink(eventsLoaded)} events loaded.`);
    } catch (e) {
      displayWarning("An error happened, no event files were found.");
      console.error(e);
    }
  }

  private bindEvent(constructor: any): void {
    if (!this.client) {
      throw new Error("The client is not set for handler.");
    }

    const EventBuilder = constructor as new (
      client: Tickly,
      todoistClient: TodoistApiClient,
      repositories: RepositoryFactory,
    ) => Event;
    const event = new EventBuilder(
      this.client,
      this.todoistClient,
      this.repositories,
    );

    if (event.once) {
      this.client.once(event.name, event.execute.bind(event));
    } else {
      this.client.on(event.name, event.execute.bind(event));
    }
  }

  /** Add a listener to error and warn Discord events. */
  private loadErrorEvents(): void {
    if (!this.client) {
      throw new Error("The client is not set for handler.");
    }

    this.client.on("warn", console.warn);
    this.client.on("error", console.error);
  }
}
