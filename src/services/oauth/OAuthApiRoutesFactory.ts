import { OAuthApiRoute } from "./OAuthApiRoute";

/**
 * Factory contract forcing the creation of the mandatory OAuth routes,
 * while allowing providers to add custom routes.
 */
export interface OAuthApiRoutesFactory {
  /** Mandatory callback route. */
  createCallbackRoute(): OAuthCallbackRoute;
  /** Mandatory success page route. */
  createSuccessRoute(): OAuthSuccessRoute;
  /** Mandatory error page route. */
  createErrorRoute(): OAuthErrorRoute;

  /**
   * Optional additional routes.
   * These can be used for provider-specific features.
   */
  createAdditionalRoutes(): OAuthApiRoute[];
}

/**
 * Mandatory callback route object.
 * It will be called by the OAuth provider after the user authorizes the app.
 *
 * It should handle the provider's response, verify the CSRF state,
 * exchange the authorization code for an access token, persist the token,
 * and finally redirect the user to the success page.
 */
export abstract class OAuthCallbackRoute extends OAuthApiRoute {
  public constructor() {
    super("/oauth/callback", "get");
  }
}

/**
 * Mandatory success route object.
 *
 * This route should display a user-friendly success message
 * and instructions on what the user should do next.
 */
export abstract class OAuthSuccessRoute extends OAuthApiRoute {
  public constructor() {
    super("/oauth/success", "get");
  }
}

/**
 * Mandatory error route object.
 *
 * This route should handle all errors related to the OAuth flow
 * and display a user-friendly message.
 */
export abstract class OAuthErrorRoute extends OAuthApiRoute {
  public constructor() {
    super("/oauth/error", "get");
  }
}
