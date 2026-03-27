import type { Request, Response } from "express";
import { OAuthSuccessRoute } from "../../oauth-api/OAuthApiRoutesFactory";

/** OAuth Success endpoint implementation for Todoist. */
export class TodoistOAuthSuccessRoute extends OAuthSuccessRoute {
    public async handle(_req: Request, res: Response): Promise<void> {
        // TODO
        res.status(200).type("html").send(`Todoist account connected. You can close this page and return to Discord.`);
    }
}
