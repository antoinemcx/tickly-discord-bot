import 'dotenv/config';
import { InMemoryUserSessionManager } from "./services/todoist/sessions/InMemoryUserSessionManager";
import { TodoistApiClient } from "./services/todoist/TodoistApiClient";

if (!process.env.TODOIST_CLIENT_ID || !process.env.TODOIST_CLIENT_SECRET) {
    console.error("TODOIST_CLIENT_ID and TODOIST_CLIENT_SECRET environment variables must be set.");
    process.exit(1);
}

const sessionManager = new InMemoryUserSessionManager();

const todoistClient = new TodoistApiClient({
    clientId: process.env.TODOIST_CLIENT_ID,
    clientSecret: process.env.TODOIST_CLIENT_SECRET,
    permissions: ["data:read_write"],
    sessionManager,
});

const demoUserId = "playground-user";

(async () => {
    const authRequest = await todoistClient.createAuthorizationRequest(demoUserId);

    // console.log("Open this URL in your browser to authorize the app:");
    // console.log(authRequest.authorizationUrl);
    console.log("OAuth state:", authRequest.state);

    const codeFromCallback = process.env.TODOIST_PLAYGROUND_ACCESS_TOKEN;
    if (!codeFromCallback) {
        console.log("Set TODOIST_PLAYGROUND_ACCESS_TOKEN to test token exchange and addTask.");
        return;
    }

    // In a real callback handler, consumeState should use the `state` query parameter returned by Todoist
    // await todoistClient.consumeState(demoUserId, authRequest.state);

    // const accessToken = await todoistClient.exchangeCodeForAccessToken(codeFromCallback);
    // await todoistClient.registerUserAccessToken(demoUserId, accessToken);
    await todoistClient.registerUserAccessToken(demoUserId, process.env.TODOIST_PLAYGROUND_ACCESS_TOKEN!);

    const task = await todoistClient.addTaskForUser(demoUserId, {
        content: "Test task from TodoistApiClient",
    });

    console.log("Task created:", {
        id: task.id,
        content: task.content,
        url: task.url,
    });
})();