import type { Request, Response } from "express";
import type { TodoistApiClient } from "../../../../services/todoist/TodoistApiClient";
import { OAuthCallbackRoute } from "../../../oauth/OAuthApiRoutesFactory";
import { AuthenticationErrors } from "../AuthenticationErrors";

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

    /* State validation */
    const session = await this.todoistApiClient.getSessionByOAuthState(state);
    if (!session) {
      this.redirectToError(AuthenticationErrors.INVALID_OAUTH_STATE, res);
      return;
    } else if (session.expiresAt && session.expiresAt.getTime() <= Date.now()) {
      this.todoistApiClient.clearUserSession(session.userId).catch(() => {});
      this.redirectToError(AuthenticationErrors.EXPIRED_OAUTH_STATE, res);
    }

    /* Token exchange and persistence */
    try {
      await this.todoistApiClient.registerUserAccessToken(
        session.userId,
        await this.todoistApiClient.exchangeOAuthCodeForAccessToken(code),
      );
    } catch {
      this.redirectToError(AuthenticationErrors.TOKEN_EXCHANGE_FAILED, res);
      return;
    }

    // TODO in the future : notify the discord app to DM the user (for both success and failure cases)

    res.redirect("/oauth/success");
  }

  private redirectToError(reason: AuthenticationErrors | string, res: Response): void {
    res.redirect(`/oauth/error?reason=${encodeURIComponent(reason)}`);
  }
}
