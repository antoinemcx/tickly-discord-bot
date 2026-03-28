import type { Request, Response } from "express";
import type { TodoistApiClient } from "../../TodoistApiClient";
import { OAuthErrorRoute } from "../../../oauth-api/OAuthApiRoutesFactory";

/** OAuth error endpoint implementation for Todoist. */
export class ErrorRoute extends OAuthErrorRoute {
    private readonly todoistApiClient: TodoistApiClient;

    public constructor(todoistApiClient: TodoistApiClient) {
        super();
        this.todoistApiClient = todoistApiClient;
    }

    public async handle(req: Request, res: Response): Promise<void> {
        const reason = typeof req.query.reason === "string" ? req.query.reason : "unknown_error";

        res.status(400).type("html").send(`OAuth connection failed. Reason: ${reason}`);
    }
}
