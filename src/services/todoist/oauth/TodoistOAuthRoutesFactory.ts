import type { TodoistApiClient } from "../../../services/todoist/TodoistApiClient";
import type { OAuthApiRoute } from "../../oauth/OAuthApiRoute";
import type { OAuthApiRoutesFactory, OAuthCallbackRoute, OAuthErrorRoute, OAuthSuccessRoute } from "../../oauth/OAuthApiRoutesFactory";

import { CallbackRoute } from "./routes/CallbackRoute";
import { ErrorRoute } from "./routes/ErrorRoute";
import { SuccessRoute } from "./routes/SuccessRoute";

/** Factory method implementation for Todoist OAuth routes. */
export class TodoistOAuthRoutesFactory implements OAuthApiRoutesFactory {
  public constructor(private readonly todoistApiClient: TodoistApiClient) {}

  public createCallbackRoute(): OAuthCallbackRoute {
    return new CallbackRoute(this.todoistApiClient);
  }

  public createSuccessRoute(): OAuthSuccessRoute {
    return new SuccessRoute(this.todoistApiClient);
  }

  public createErrorRoute(): OAuthErrorRoute {
    return new ErrorRoute(this.todoistApiClient);
  }

  public createAdditionalRoutes(): OAuthApiRoute[] {
    return [];
  }
}
