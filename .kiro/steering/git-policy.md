---
inclusion: auto
name: git-policy
description: Rules for Git operations in sessions and workflows
---

# Git Policy

**Agents must NEVER execute Git commands** — neither in direct sessions nor within workflows.

## What agents must NOT do

- `git add`, `git commit`, `git push`, `git pull`, `git merge`, `git rebase`, etc.
- Any command that modifies the Git history or state

## What agents CAN do

- **Suggest** a commit when the repository is in a stable state (build passes, tests pass, lint clean)
- Provide a suggested commit message
- Indicate which files would be included

## Why

The user maintains full control over version control. This prevents:
- Unwanted commits polluting history
- Accidental pushes to remote
- Conflicts with the user's branching strategy

## Example

```
✅ "The implementation is complete and all tests pass. This would be a good point to commit. 
   Suggested message: ✨ Add AES-256-GCM encryption for Todoist tokens"

❌ git add . && git commit -m "✨ Add encryption"
```
