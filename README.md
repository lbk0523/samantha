# Samantha Harness Restart

Last updated: 2026-05-12

## Decision

The Telegram-first 24/7 Samantha control-plane plan is retired.

The next Samantha should be a personal software development harness for Codex
work, not a remote command bot and not an always-on LLM office.

The new core product is:

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

The new repo should start with a narrow package and CLI.

Suggested package shape:

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
  commands/
    run-task.ts
    inspect-run.ts
    merge-check.ts
tests/
references/
  agent-profiles/
  tasks/
```

The old repository should be treated as a reference implementation. Do not copy
`src/samantha.ts` forward.

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

