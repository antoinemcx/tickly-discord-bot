import type { Request, Response } from "express";
import type { TodoistApiClient } from "../../TodoistApiClient";
import { OAuthSuccessRoute } from "../../../oauth-api/OAuthApiRoutesFactory";

/** OAuth Success endpoint implementation for Todoist. */
export class SuccessRoute extends OAuthSuccessRoute {
    private readonly todoistApiClient: TodoistApiClient;

    public constructor(todoistApiClient: TodoistApiClient) {
        super();
        this.todoistApiClient = todoistApiClient;
    }

    public async handle(_req: Request, res: Response): Promise<void> {
        res.status(200).type("html").send(`Todoist account connected. You can close this page and return to Discord.`);
    }
}
