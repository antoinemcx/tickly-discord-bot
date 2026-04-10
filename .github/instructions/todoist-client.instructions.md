---
description: "Use when changing Todoist integration, OAuth routes, session management, or command flows that call Todoist. Enforces single integration point, SDK-first documentation lookup, and performance-minded design."
name: "Todoist Integration Guidelines"
applyTo: ["src/services/todoist/**/*.ts", "src/services/oauth/**/*.ts", "src/bot/commands/**/*.ts", "src/bot/events/**/*.ts"]
---
# Todoist Integration Guidelines

- Treat src/services/todoist/TodoistApiClient.ts as the single Todoist SDK integration point for bot features.
- Prefer extending TodoistApiClient capabilities over introducing direct SDK calls in unrelated layers.
- Favor object-oriented designs aligned with Todoist TypeScript SDK types and abstractions.
- For Todoist behavior questions, consult the Todoist TypeScript SDK documentation first, then fallback to the Todoist REST API documentation if required.
- Document thrown and propagated exceptions in public methods, including exceptions coming from Todoist and Discord SDK calls.
- Prefer performance-minded implementations: avoid unnecessary allocations, repeated API calls, and redundant persistence operations.
