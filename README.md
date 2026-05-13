# Samantha Harness Restart

Last updated: 2026-05-13

## Decision

The Telegram-first 24/7 Samantha control-plane plan is retired.

The next Samantha should be a personal software development harness for Codex
work, not a remote command bot and not an always-on LLM office.

The core product loop is:

```text
task spec
-> isolated worktree
-> Codex run
-> HARNESS_RESULT
-> deterministic verification
-> Samantha-owned commit/report
```

The current `samantha-codex` repository remains useful as a prototype and source
of tested components. It should not remain the main implementation base for the
next product because too much code, state, and documentation is shaped around
Telegram, remote adapters, daemon operation, and CEO-office command workflows.

## Product Shape

Samantha should help BK run software work with discipline:

- define scoped tasks
- isolate code changes
- run Codex under explicit boundaries
- verify results
- record auditable evidence
- produce concise implementation reports
- keep merge, push, cleanup, recovery, and authority changes explicit

The first useful version does not need:

- Telegram
- 24/7 daemon operation
- remote approval flows
- CEO turn memory
- dashboard
- routine triggers
- budget governance
- multi-project orchestration
- multi-writer execution

Those can be reconsidered only after the core harness is routinely useful.

## Direction Documents

- `NORTH_STAR.md` defines the CEO-style local development harness direction.
- `ARCHITECTURE.md` maps the current implementation to the harness layers.
- `LEARNING_ARCHITECTURE.md` sketches explicit, reviewable self-learning for
  the agent organization.

## Core Principles

- Codex may write code only inside a Samantha-allocated worktree.
- Every task must declare target files, forbidden files, and verify commands.
- Writer output must include `HARNESS_RESULT`.
- Samantha, not the worker, owns the final commit.
- Verification happens outside the worker's judgment.
- Merge, push, cleanup, retry, recovery, connector access, and secret access are
  separate gates.
- Non-writer roles are report-only and should not edit files.
- Keep the first implementation small enough to understand in one sitting.

## New Repo Boundary

The repo should stay a narrow package and CLI.

Current package shape:

```text
src/
  cli.ts
  core/
    contracts.ts
    harness-result.ts
    policy.ts
    git.ts
    worktree.ts
    codex-dispatch.ts
    worker-result.ts
    worker-dispatch.ts
    run-log.ts
    ledger.ts
    merge-gate.ts
    run-lifecycle-store.ts
    worktree-cleanup.ts
    lesson-draft.ts
    task-from-template.ts
  commands/
    run-task.ts
tests/
references/
  agent-profiles/
  tasks/
  task-templates/
```

The old repository should be treated as a reference implementation. Do not copy
`src/samantha.ts` forward.

## Current CLI Surface

```bash
bun run samantha run-task <task.json> --repo-root=<repo>
bun run samantha runs:list
bun run samantha runs:show <run-id>
bun run samantha merge:check --run-log=<path> --repo-root=<repo>
bun run samantha runs:mark-lifecycle --run-log=<path> --repo-root=<repo> --event=merged|cleaned
bun run samantha worktree:cleanup --run-log=<path> --repo-root=<repo>
bun run samantha lessons:draft --run-log=<path>
bun run samantha tasks:from-template <template-id> --task-id=<id> --title=<title>
```

Current task templates:

- `references/task-templates/docs-only.json`
- `references/task-templates/core-module-with-tests.json`
- `references/task-templates/cli-command-with-tests.json`
- `references/task-templates/report-only-review.json`

## MVP Acceptance

The new Samantha harness MVP is complete when:

- a fixture writer task runs in an isolated worktree
- Codex receives a scoped prompt with target and forbidden files
- Samantha parses the worker's `HARNESS_RESULT`
- changed files are checked against scope
- declared verification commands pass
- Samantha creates the commit after gates pass
- a JSON run log records prompt, command, output, changed files, verification,
  and commit
- a failed or out-of-scope worker result is rejected without committing

## Legacy Position

Keep `samantha-codex` available for:

- tested module behavior
- old dogfood evidence
- migration reference
- examples of gates that may be reintroduced later

Do not keep investing in:

- Telegram UX polish
- remote command choreography
- CEO turn approval matching
- daemon/watch/poll/reply flows
- large `samantha.ts` refactors
