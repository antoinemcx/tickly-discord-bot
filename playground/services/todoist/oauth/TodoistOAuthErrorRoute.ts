import type { Request, Response } from "express";
import { OAuthErrorRoute } from "../../oauth-api/OAuthApiRoutesFactory";

/** OAuth error endpoint implementation for Todoist. */
export class TodoistOAuthErrorRoute extends OAuthErrorRoute {
    public async handle(req: Request, res: Response): Promise<void> {
        const reason = typeof req.query.reason === "string" ? req.query.reason : "unknown_error";

        // TODO
        res.status(400).type("html").send(`OAuth connection failed. Reason: ${reason}`);
    }
}
