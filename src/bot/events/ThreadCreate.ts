import type { AnyThreadChannel } from "discord.js";
import { Events } from "discord.js";
import { Event } from "./Event";

export default class ThreadCreate extends Event<Events.ThreadCreate> {
  public override name: Events.ThreadCreate = Events.ThreadCreate;

  public async execute(thread: AnyThreadChannel): Promise<void> {
    if (thread.joinable) {
      thread.join().catch(() => {});
    }
  }
}
