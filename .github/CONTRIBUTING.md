# Contributing to Tickly

Thank you for your interest in contributing to Tickly! This guide outlines the workflow and conventions to follow.

## Getting Started

1. Fork the repository and clone it locally.
2. Follow the setup instructions in the **Getting Started** section of the [README](../README.md).

## Contribution Workflow

### 1. Issue First

Every change **must** be linked to an issue that has been reviewed and moved to the **"Backlog"** column on the [project board](https://github.com/users/antoinemcx/projects/3/views/1).  
Do not start working on something that hasn't been validated.

### 2. Branching (Git-Flow)

Create a branch from `master` following git-flow conventions:

| Type | Prefix | Example |
|------|--------|---------|
| New feature | `feature/` | `feature/todoist-filters` |
| Bug fix | `fix/` | `fix/oauth-token-refresh` |
| Hotfix (critical) | `hotfix/` | `hotfix/crash-on-startup` |

If an issue has sub-tasks, you can chose to only create the branch for the parent issue.

### 3. Commits (Gitmoji)

Use [Gitmoji](https://gitmoji.dev/) at the start of each commit message.  
Reference the associated issue number in parentheses at the end.

```
✨ Task filters command (#42)
🐛 Session expiration handling (#58)
♻️ OAuth routes in factory (#60)
```

### 4. Pull Request

- Push your branch and open a Pull Request targeting `master`.
- Fill in the PR description with a summary of the changes and a link to the issue.
- Request a review from GitHub Copilot and fix any issues it identifies.
- Request a review from @antoinemcx.
- Make sure CI checks pass (build, lint, tests).

### 5. Review & Merge

PRs are reviewed by the maintainers. Address feedback promptly and keep commits clean (squash fixups if needed).  
Once approved, a maintainer will merge the PR.

## Development Guidelines

- Run `npm run build` to compile and `npm test` to run the test suite before pushing.
- Run `npm run lint` to check for linting errors (`npm run lint:fix` to auto-fix).
- Follow the coding conventions described in [copilot-instructions.md](./.github/../copilot-instructions.md).

## Using AI Assistants

If you use AI coding agents (GitHub Copilot, etc.), leverage the instruction files provided in the **.github/** folder for better context.

These files help AI tools generate code that aligns with the project's architecture and conventions.

## Reporting Bugs & Suggesting Features

- Open an issue with the `bug` or `enhancement` label.
- Provide as much context as possible (steps to reproduce, expected behavior, screenshots).
- You can also share feedback on the [support Discord server](https://antoinemcx.fr/discord).
