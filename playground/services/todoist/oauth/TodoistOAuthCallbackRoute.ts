import type { Request, Response } from "express";
import { OAuthCallbackRoute } from "../../oauth-api/OAuthApiRoutesFactory";
import { AuthenticationErrors } from "./AuthenticationErrors";

/** OAuth Callback endpoint implementation for Todoist. */
export class TodoistOAuthCallbackRoute extends OAuthCallbackRoute {
    public async handle(req: Request, res: Response): Promise<void> {
        const { code, state, error } = req.query;

        if (typeof error === "string") {
            this.redirectToError(error, res);
            return;
        }

        /* Request validation */
        if (!code || !state || typeof code !== "string" || typeof state !== "string") {
            this.redirectToError(AuthenticationErrors.INVALID_CALLBACK_QUERY, res);
            return;
        }
        // TODO validate state against stored value to prevent CSRF attacks

        /* Token exchange and persistence */
        // TODO token exchange logic (and handle errors)
        // TODO persist access token in memory store or database, associated with the user
        
        // TODO in the future : publish an event or whatever to notify the discord app

        res.redirect("/oauth/success");
    }

    private redirectToError(reason: AuthenticationErrors | string, res: Response): void {
        res.redirect(`/oauth/error?reason=${encodeURIComponent(reason)}`);
    }
}
