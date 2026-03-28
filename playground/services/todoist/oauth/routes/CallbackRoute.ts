import type { Request, Response } from "express";
import { AuthenticationErrors } from "../AuthenticationErrors";
import type { TodoistApiClient } from "../../TodoistApiClient";
import { OAuthCallbackRoute } from "../../../oauth-api/OAuthApiRoutesFactory";

/** OAuth Callback endpoint implementation for Todoist. */
export class CallbackRoute extends OAuthCallbackRoute {
    private readonly todoistApiClient: TodoistApiClient;

    public constructor(todoistApiClient: TodoistApiClient) {
        super();
        this.todoistApiClient = todoistApiClient;
    }

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
        
        const session = await this.todoistApiClient.getSessionByOAuthState(state);
        if (!session) {
            this.redirectToError(AuthenticationErrors.INVALID_OAUTH_STATE, res);
            return;
        }

        try {
            await this.todoistApiClient.consumeState(session.userId, state);
        } catch {
            this.redirectToError(AuthenticationErrors.INVALID_OAUTH_STATE, res);
            return;
        }

        /* Token exchange and persistence */
        try {
            const accessToken = await this.todoistApiClient.exchangeCodeForAccessToken(code);
            await this.todoistApiClient.registerUserAccessToken(session.userId, accessToken);
        } catch {
            this.redirectToError(AuthenticationErrors.TOKEN_EXCHANGE_FAILED, res);
            return;
        }
        
        // TODO in the future : publish an event or whatever to notify the discord app

        res.redirect("/oauth/success");
    }

    private redirectToError(reason: AuthenticationErrors | string, res: Response): void {
        res.redirect(`/oauth/error?reason=${encodeURIComponent(reason)}`);
    }
}
