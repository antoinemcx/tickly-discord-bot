import type { Request, Response } from "express";
import type { OAuthApiRoutesContract } from "../../oauth-api/OAuthApiRoutesContract";

/**
 * Todoist-specific implementation for OAuth endpoints.
 */
export class TodoistOAuthRoutes implements OAuthApiRoutesContract {
    public async callback(req: Request, res: Response): Promise<void> {
        const { code, state, error } = req.query;

        if (typeof error === "string") {
            res.redirect(`/oauth/error?reason=${encodeURIComponent(error)}`);
            return;
        }

        if (typeof code !== "string" || typeof state !== "string") {
            res.redirect("/oauth/error?reason=invalid_callback_query");
            return;
        }

        // Token exchange and persistence will be added in the next iteration.
        res.redirect("/oauth/success");
    }

    public async success(_req: Request, res: Response): Promise<void> {
        res.status(200).type("html").send(`
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Todoist Connected</title>
</head>
<body>
  <h1>Todoist account connected</h1>
  <p>You can close this page and return to Discord.</p>
</body>
</html>
`);
    }

    public async error(req: Request, res: Response): Promise<void> {
        const reason = typeof req.query.reason === "string" ? req.query.reason : "unknown_error";

        res.status(400).type("html").send(`
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OAuth Error</title>
</head>
<body>
  <h1>OAuth connection failed</h1>
  <p>Reason: ${reason}</p>
  <p>Please return to Discord and try again.</p>
</body>
</html>
`);
    }
}
