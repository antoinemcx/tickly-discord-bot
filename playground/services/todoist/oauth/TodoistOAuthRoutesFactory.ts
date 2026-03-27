import type { OAuthApiRoute } from "../../oauth-api/OAuthApiRoute";
import type { OAuthApiRoutesFactory } from "../../oauth-api/OAuthApiRoutesFactory";
import { TodoistOAuthCallbackRoute } from "./TodoistOAuthCallbackRoute";
import { TodoistOAuthErrorRoute } from "./TodoistOAuthErrorRoute";
import { TodoistOAuthSuccessRoute } from "./TodoistOAuthSuccessRoute";

/** Factory method implementation for Todoist OAuth routes. */
export class TodoistOAuthRoutesFactory implements OAuthApiRoutesFactory {
    public createCallbackRoute(): TodoistOAuthCallbackRoute {
        return new TodoistOAuthCallbackRoute();
    }

    public createSuccessRoute(): TodoistOAuthSuccessRoute {
        return new TodoistOAuthSuccessRoute();
    }

    public createErrorRoute(): TodoistOAuthErrorRoute {
        return new TodoistOAuthErrorRoute();
    }

    public createAdditionalRoutes(): OAuthApiRoute[] {
        return [];
    }
}
