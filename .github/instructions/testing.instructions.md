---
description: "Use when writing, updating, or reviewing tests. Enforces the test structure, AAA pattern, naming conventions, and rerun-on-failure workflow."
name: "Testing Guidelines"
applyTo: ["tests/**/*.ts"]
---
# Testing Guidelines

- Organize tests with one `describe` block per class or unit under test.
- Put shared setup and mocks in `beforeEach` and/or `beforeAll` inside the class-level `describe`.
- Use one `describe` block per public method or behavior.
- Method-level `describe` blocks may contain nested `describe` blocks when the method has multiple scenarios, or they may contain `it` blocks directly.
- Structure each test with `Arrange`, `Act`, and `Assert` sections.
- Name `it` blocks with `should ...` and optionally `when ...` to describe the expected behavior.
- Mock external services and IO boundaries instead of calling them directly.
- If a test fails, rerun the failing test and iterate until the failure is understood or resolved.
- Keep assertions focused on behavior, not implementation details, unless the behavior depends on a specific interaction.
