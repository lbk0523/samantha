# Samantha Harness

Last updated: 2026-05-15

## Decision

Samantha is the active CEO-style local development harness for BK's Codex
software work.

The migration from `samantha-codex` is complete. Historical migration notes are
not active requirements; current direction comes from:

- `AGENTS.md`
- `NORTH_STAR.md`
- `ARCHITECTURE.md`
- `ROADMAP.md`

The core product loop is:

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

## How To Use Samantha

Samantha v0 is operated through Codex Chat with an explicit operating prefix:

```text
Samantha <intent>: <natural language request>
```

Official debut intents are `command`, `brainstorm`, `plan`, `review`,
`recover`, `inspect`, and `learn`.

Example:

```text
Samantha command: 이 repo에서 runs:list 출력이 너무 거칠어. 최근 run의 상태와 다음 액션을 한눈에 보이게 개선해줘.
```

Only explicit `Samantha <intent>:` messages activate the operating protocol.
`Samantha command:` normalizes executable work into a bounded plan, task spec,
or ready-to-send `/goal` first; it does not bypass worktree isolation, scope
checks, deterministic verification, run evidence, or Samantha-owned lifecycle
gates.

See `OPERATING_GUIDE.md` for the full protocol and examples.

`Samantha brainstorm` is the pre-execution direction surface for product and MVP
UI/UX discussion. It may use temporary browser mockups as conversation aids, but
it should end in a Brainstorm Brief rather than code, task specs, worker
dispatches, or committed UX specs by default.

When a brainstorm or plan creates multiple dependent slices, preserve the parent
context in an Initiative Continuity Brief under `references/initiatives/`. The
brief is reviewable repo state for accepted decisions, the slice queue, and the
next-session prompt; it does not replace task specs, run logs, verification, or
lifecycle gates.

For cross-repo Codex Chat use, activation is provided by the global
`samantha-operator` skill; this README and the operating guides describe the
protocol, not a daemon or chat adapter.

## Product Shape

Samantha should help BK run software work with discipline:

- define scoped tasks
- isolate code changes
- run Codex under explicit boundaries
- verify results
- record auditable evidence
- produce concise implementation reports
- keep merge, push, cleanup, recovery, and authority changes explicit

Adjacent surfaces such as chat adapters, daemon operation, dashboards, routine
triggers, budget governance, multi-project orchestration, and multi-writer
execution should be introduced only as reviewed product slices with explicit
authority and verification gates.

Single-writer execution is an MVP constraint, not a permanent doctrine:
post-MVP parallelism starts with report-only workers and can use speculative
writer batches only through Samantha-owned BatchSpec gates, isolated worktrees,
ordered integration, and post-merge verification. This does not raise
`writerCap` or give workers orchestration authority.

## Repository Boundary

The repo should stay a narrow package and CLI while the harness core matures.

Current package shape:

```text
src/
  cli.ts
  core/
    batch-execution.ts
    batch-replan.ts
    batch-spec-store.ts
    batch-spec.ts
    codex-dispatch.ts
    contracts.ts
    git.ts
    glob.ts
    harness-result.ts
    ledger.ts
    lesson-draft.ts
    lesson-inbox-review.ts
    lesson-promote.ts
    lesson-review.ts
    merge-gate.ts
    policy.ts
    post-run-trajectory.ts
    run-accept.ts
    run-commit.ts
    run-diagnose.ts
    run-lifecycle-store.ts
    run-list.ts
    run-log.ts
    run-show.ts
    task-from-run.ts
    task-from-template.ts
    task-family.ts
    worker-dispatch.ts
    worker-result.ts
    worktree-cleanup.ts
    worktree.ts
  commands/
    orchestrate-reports.ts
    run-task.ts
tests/
references/
  agent-profiles/
  initiatives/
  lessons/
  playbooks/
  tasks/
  task-templates/
```

## Core Principles

- Codex may write code only inside a Samantha-allocated worktree.
- Writer tasks must declare target files, forbidden files, and verify commands.
- Non-writer report tasks must declare no target files, setup commands, or verify
  commands.
- Worker output must include `HARNESS_RESULT`.
- Samantha, not the worker, owns the final commit.
- Verification happens outside the worker's judgment.
- Merge, push, cleanup, retry, recovery, connector access, and secret access are
  separate gates.
- Non-writer roles are report-only and should not edit files.
- Workers must not own orchestration; future parallelism belongs to Samantha.
- Learning must be explicit repository artifacts: candidates, reviews,
  playbooks, templates, profiles, policy/tests, or direction documents.
- Hidden memory, automatic promotion, and unreviewed authority changes are not
  allowed.
- Keep the implementation small enough to understand in one sitting.

## Current CLI Surface

```bash
bun run samantha run-task <task.json> --repo-root=<repo>
bun run samantha runs:list
bun run samantha runs:show <run-id>
bun run samantha merge:check --run-log=<path> --repo-root=<repo>
bun run samantha runs:mark-lifecycle --run-log=<path> --repo-root=<repo> --event=merged|cleaned
bun run samantha worktree:cleanup --run-log=<path> --repo-root=<repo>
bun run samantha runs:accept --run-log=<path> --repo-root=<repo>
bun run samantha runs:diagnose --run-log=<path>
bun run samantha reports:summarize --run-log=<path> [--run-log=<path>]...
bun run samantha reports:orchestrate --repo-root=<repo> --task=<task.json> --task=<task.json>...
bun run samantha readiness:check [--initiative=<path>] [--task=<task.json>] [--run-log=<path>]
bun run samantha lessons:draft --run-log=<path>
bun run samantha lessons:review <candidate.md>
bun run samantha lessons:review-inbox [--repo-root=<repo>]
bun run samantha lessons:promote <candidate.md> --playbook-id=<id>
bun run samantha lessons:record-evidence <playbook.md> --run-log=<path> --assessment=helped|not-helped|unclear --note=<note>
bun run samantha tasks:from-template <template-id> --task-id=<id> --title=<title> [--set=<placeholder>:<value>]...
bun run samantha tasks:from-run --run-log=<path> --task-id=<id> --title=<title>
bun run samantha batches:list
bun run samantha batches:show --batch-id=<id>
bun run samantha batches:preflight --batch=<path>
bun run samantha batches:execute --batch=<path> --target-branch=<branch>
bun run samantha batches:reject --batch=<path> --reason=<reason>
bun run samantha batches:replace --batch=<path> --replacement-batch-id=<id> --replacement=<path> --replan-evidence=<path>
```

Phase 5 stale-base replacement and source rejection stay deliberately separate:

- stale-base preflight or integration records `block_and_replan` evidence with
  `sourceBatchSpecMutation: "not_performed"`; it does not automatically create
  a replacement or close the source `BatchSpec`
- `batches:replace` is Samantha-owned planning only: it consumes matching
  stale-base evidence, creates a new planned `BatchSpec` at `observedHead`,
  clears worker run and candidate evidence, and still requires ordinary
  BatchSpec preflight (`batches:preflight`) before dispatch
- `batches:reject` is the separate Samantha-owned source closure: it mutates
  only the source top-level `status` to `rejected` and writes lifecycle audit
  evidence
- rebase execution, `writerCap` increases, worker-owned orchestration, and
  worker-owned lifecycle mutation remain outside the implemented boundary

Current task templates:

- `references/task-templates/docs-only.json`
- `references/task-templates/core-module-with-tests.json`
- `references/task-templates/cli-command-with-tests.json`
- `references/task-templates/report-only-review.json`

`readiness:check` is a deterministic report-only surface. With `--initiative`,
it checks an Initiative Continuity Brief for required sections, valid slice
statuses, blockers, and a current next slice. With `--task` and `--run-log`, it
audits plan completion by comparing the task spec against run evidence,
declared verification, scope evaluation, HARNESS_RESULT, and candidate commit
state.

## Acceptance Baseline

Samantha's core loop is credible when:

- a writer task runs in an isolated worktree
- Codex receives a scoped prompt with target and forbidden files
- Samantha parses the worker's `HARNESS_RESULT`
- changed files are checked against scope
- declared verification commands pass
- Samantha creates the commit after gates pass
- a JSON run log records prompt, command, output, changed files, verification,
  and commit
- failed or out-of-scope worker output is rejected without committing
- post-run merge, acceptance, cleanup, diagnosis, lesson drafting, lesson
  review, promotion, and later evidence recording remain explicit operations
- report-only runs allocate no worktree, create no commit, and remain advice-only
  evidence for a Samantha decision point
- BatchSpec writer batches re-run preflight, dispatch only eligible writer
  groups from `baseCommit`, integrate candidates in queue order, verify after
  accepted merges, record stale-base `block_and_replan` evidence, record
  lifecycle evidence, clean up only after terminal accepted evidence, and allow
  source BatchSpec rejection and explicit stale-base replacement generation only
  through Samantha-owned commands with audit evidence
