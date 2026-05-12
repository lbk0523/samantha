# Samantha Harness Rules

## Product Boundary

Samantha is a personal Codex development harness.

The MVP loop is:

```text
task spec
-> isolated worktree
-> Codex run
-> HARNESS_RESULT
-> deterministic verification
-> Samantha-owned commit/report
```

## Forbidden MVP Scope

Do not implement Telegram, remote adapters, daemon/watch services, dashboard,
CEO-office memory, routine triggers, budget governance, or multi-project
orchestration.

Do not copy `src/samantha.ts` from the old `samantha-codex` repository.

## Engineering Rules

- Keep changes surgical and test-driven.
- Prefer the smallest readable implementation that satisfies the current phase.
- Treat `samantha-codex` as a reference implementation, not the active product.
- Samantha, not a worker, owns commits after deterministic gates pass.
- Every writer task must declare target files, forbidden changes, and verify
  commands.
