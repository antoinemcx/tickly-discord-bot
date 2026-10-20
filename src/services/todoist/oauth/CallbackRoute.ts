import type { NotificationService } from "@bot/services/NotificationService";
import type { TranslationLoader } from "@services/apiBuilder/TranslationLoader";
import type { OAuthPageRenderer } from "@services/oauth/OAuthPageRenderer";
import type { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import type { Locale } from "discord.js";
import type { Request, Response } from "express";
import { ApiRoute } from "@services/apiBuilder/ApiRoute";
import { AuthenticationErrors } from "./AuthenticationErrors";

/** OAuth Callback endpoint for Todoist. */
export class CallbackRoute extends ApiRoute {
  /** Optional notifier injected once the bot is ready */
  private notificationService?: NotificationService;

  public constructor(
    private readonly todoistApiClient: TodoistApiClient,
    private readonly renderer: OAuthPageRenderer,
    private readonly loader: TranslationLoader,
  ) {
    super("/oauth/callback", "get");
  }

  /**
   * Injects the notification service to enable DM notification
   * for successful login.
   * @param service the notification service to use for DMs
   */
  public setNotificationService(service: NotificationService): void {
    this.notificationService = service;
  }

  /**
   * Handles the OAuth2 callback from Todoist.
   *
   * Validates the CSRF state, checks session expiry, exchanges the
   * authorization code for an access token, and persists it.
   * Renders the success or error page directly in the response.
   *
   * @param req the incoming Express request
   * @param res the Express response
   * @throws {PersistenceError} if session lookup or update fails unexpectedly
   */
  public async handle(req: Request, res: Response): Promise<void> {
    const { code, state, error } = req.query;
    const locale = typeof state === "string" ? this.extractLocale(state) : "en-US";

    if (typeof error === "string") {
      this.sendErrorPage(res, locale, error);
      return;
    }

    /* Request validation */
    if (!code || !state || typeof code !== "string" || typeof state !== "string") {
      this.sendErrorPage(res, locale, AuthenticationErrors.INVALID_CALLBACK_QUERY);
      return;
    }

    /* State validation */
    const csrfState = this.extractCsrf(state);
    const session = await this.todoistApiClient.getSessionByOAuthState(csrfState);
    if (!session) {
      this.sendErrorPage(res, locale, AuthenticationErrors.INVALID_OAUTH_STATE);
      return;
    } else if (session.expiresAt && session.expiresAt.getTime() <= Date.now()) {
      this.todoistApiClient.clearUserSession(session.userId).catch(() => {});
      this.sendErrorPage(res, locale, AuthenticationErrors.EXPIRED_OAUTH_STATE);
      return;
    }

    /* Token exchange and persistence */
    try {
      await this.todoistApiClient.registerUserAccessToken(
        session.userId,
        await this.todoistApiClient.exchangeOAuthCodeForAccessToken(code),
      );
    } catch {
      this.sendErrorPage(res, locale, AuthenticationErrors.TOKEN_EXCHANGE_FAILED);
      return;
    }

    this.notificationService
      ?.notifyLoginSuccess(session.userId, locale as Locale)
      .catch(() => {});

    res.status(200).type("html").send(this.renderer.renderSuccess(locale, this.loader));
  }

  /** Extracts the locale code embedded in the OAuth state (format: `csrfPart|locale`). */
  private extractLocale(state: string): string {
    const pipeIndex = state.lastIndexOf("|");
    return pipeIndex !== -1 ? state.slice(pipeIndex + 1) : "en-US";
  }

  /** Extracts the CSRF token from the OAuth state (format: `csrfPart|locale`). */
  private extractCsrf(state: string): string {
    const pipeIndex = state.lastIndexOf("|");
    return pipeIndex !== -1 ? state.slice(0, pipeIndex) : state;
  }

  private sendErrorPage(res: Response, locale: string, reason: string) {
    res.status(400).type("html").send(
      this.renderer.renderError(locale, reason, this.loader),
    );
  }
}
