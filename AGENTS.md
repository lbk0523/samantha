# Samantha Harness Rules

## Product Boundary

Samantha is a CEO-style local development harness for BK's Codex software work.

The CEO layer may discuss direction with BK, decompose goals, choose task
sequence, run the harness, and report results. Once work becomes executable, it
must be represented as task specs, agent profiles, policies, worktrees,
verification commands, run logs, and lifecycle records.

The MVP loop is:

```text
minimal user goal
-> Samantha CEO decomposition
-> task spec
-> isolated worktree
-> Codex run
-> HARNESS_RESULT
-> deterministic verification
-> Samantha-owned commit/report
```

Read these direction documents before broad architectural changes:

- `NORTH_STAR.md`
- `ARCHITECTURE.md`
- `LEARNING_ARCHITECTURE.md`

## Forbidden MVP Scope

Do not implement Telegram, remote adapters, daemon/watch services, dashboard,
CEO-office memory, routine triggers, budget governance, or multi-project
orchestration.

The new CEO layer is allowed. The old `samantha-codex` CEO-office product
direction is not allowed. Do not revive remote command choreography, Telegram
approval flows, continuous polling, or hidden CEO turn memory.

Do not copy `src/samantha.ts` from the old `samantha-codex` repository.

## Learning Rules

Samantha may learn from repeated software work only through explicit,
reviewable repository artifacts.

Allowed learning artifacts include:

- markdown direction documents
- playbooks
- task templates
- agent profiles
- TypeScript policy checks with tests
- run summaries
- lifecycle records

Do not add hidden memory. Do not silently rewrite policy or doctrine. If a
lesson should change future behavior, write it as a candidate artifact first or
add a reviewed policy/test change.

## Engineering Rules

- Keep changes surgical and test-driven.
- Prefer the smallest readable implementation that satisfies the current phase.
- Treat `samantha-codex` as a reference implementation, not the active product.
- Samantha, not a worker, owns commits after deterministic gates pass.
- Every writer task must declare target files, forbidden changes, and verify
  commands.
