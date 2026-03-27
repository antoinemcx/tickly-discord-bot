import type { Request, Response } from "express";
import { OAuthCallbackRoute } from "../../oauth-api/OAuthApiRoutesFactory";

/** OAuth Callback endpoint implementation for Todoist. */
export class TodoistOAuthCallbackRoute extends OAuthCallbackRoute {
    public async handle(req: Request, res: Response): Promise<void> {
        const { code, state, error } = req.query;

        if (typeof error === "string") {
            res.redirect(`/oauth/error?reason=${encodeURIComponent(error)}`);
            return;
        }

        if (typeof code !== "string" || typeof state !== "string") {
            res.redirect("/oauth/error?reason=invalid_callback_query");
            return;
        }

        /* Request validation */
        // TODO check response format includes code and state
        // TODO validate state against stored value to prevent CSRF attacks

        /* Token exchange and persistence */
        // TODO token exchange logic (and handle errors)
        // TODO persist access token in memory store or database, associated with the user
        
        // TODO publish an event or whatever to notify the app (how ?? device flow ??)

        res.redirect("/oauth/success");
    }
}
