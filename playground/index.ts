import type { UserSessionManager } from "@services/todoist/sessions/UserSessionManager";
import { OAuthApiService } from "@services/oauth/OAuthApiService";
import { TodoistOAuthRoutesFactory } from "@services/todoist/oauth/TodoistOAuthRoutesFactory";
import { InMemoryUserSessionManager } from "@services/todoist/sessions/InMemoryUserSessionManager";
import { UserSessionStatus } from "@services/todoist/sessions/UserSession";
import { TodoistApiClient } from "@services/todoist/TodoistApiClient";
import "dotenv/config";

if (!process.env.TODOIST_CLIENT_ID || !process.env.TODOIST_CLIENT_SECRET) {
  console.error("TODOIST_CLIENT_ID and TODOIST_CLIENT_SECRET environment variables must be set.");
  process.exit(1);
}

const sessionManager: UserSessionManager = new InMemoryUserSessionManager();

const todoistClient = new TodoistApiClient(
  process.env.TODOIST_CLIENT_ID,
  process.env.TODOIST_CLIENT_SECRET,
  sessionManager,
  { permissions: ["data:read_write"] },
);

const oauthApiService = new OAuthApiService(
  new TodoistOAuthRoutesFactory(todoistClient),
);

const demoUserId = "playground-user";

async function sleep(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  await oauthApiService.start(3999);

  const authorizationUrl = await todoistClient.createOAuthAuthorizationUrl(demoUserId);

  console.log("OAuth callback service started on port 3999.");
  console.log("Callback endpoint: http://localhost:3999/oauth/callback");
  console.log("Open this URL in your browser to authorize the app:");
  console.log(authorizationUrl);

  // const codeFromCallback = process.env.TODOIST_PLAYGROUND_ACCESS_TOKEN;
  // if (!codeFromCallback) {
  //     console.log("Set TODOIST_PLAYGROUND_ACCESS_TOKEN to test token exchange and addTask.");
  //     return;
  // }
  let accessToken: string | null = null;
  do {
    await todoistClient.pruneExpiredSessions();
    const session = await sessionManager.getSession(demoUserId);

    if (session?.status === UserSessionStatus.Completed && typeof session.accessToken === "string") {
      accessToken = session.accessToken;
      console.log("OAuth completed. Access token stored in session manager.");
      break;
    }

    await sleep(1000);
  } while (!accessToken);

  // In a real callback handler, consumeState should use the `state` query parameter returned by Todoist
  // await todoistClient.consumeState(demoUserId, authRequest.state);

  // const accessToken = await todoistClient.exchangeCodeForAccessToken(codeFromCallback);
  // await todoistClient.registerUserAccessToken(demoUserId, accessToken!);
  // await todoistClient.registerUserAccessToken(demoUserId, process.env.TODOIST_PLAYGROUND_ACCESS_TOKEN!);

  const task = await todoistClient.addTaskForUser(demoUserId, {
    content: "Test task from TodoistApiClient",
  });

  console.log("Task created:", {
    id: task.id,
    content: task.content,
    url: task.url,
  });
})();
