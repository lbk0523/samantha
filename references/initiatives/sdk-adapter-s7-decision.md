# SDK Adapter S7 Promotion Decision

Date: 2026-05-16
Status: completed
Decision: retain `codex-sdk` as an explicit experimental runtime

## Findings

### Gate Preservation

Evidence supports keeping the SDK runtime available behind an explicit option:

- `exec-json` remains the default worker runtime.
- `run-task --runtime=codex-sdk` is the only live SDK selector.
- The SDK adapter returns the same `WorkerDispatchExecution` surface used by
  existing Samantha evaluation.
- Fake SDK tests prove SDK output still flows through Samantha-owned
  `HARNESS_RESULT` parsing, report-only scope checks, and commit gates.
- The live report-only SDK dogfood run passed without changed files, scope
  violations, verify results, or commits.
- S6 recovery semantics treat SDK `threadId` as optional follow-up context
  only; task specs, repository state, target files, and verify commands remain
  authoritative.

This satisfies the minimum evidence to keep the SDK path in the codebase.

### Evidence Quality

The SDK path improves run evidence in narrow ways:

- live SDK runtime metadata includes `kind`, `threadId`, and streamed event
  counts;
- thread continuity can be carried into failed-run follow-up instructions
  without making SDK thread state authoritative;
- event counts make it clearer that the SDK run reached thread and turn
  lifecycle events.

This is useful evidence, but not enough to promote SDK as a normal runtime.

### Promotion Gaps

Promotion is premature because current evidence is still narrow:

- there is only one live SDK dogfood run;
- the live dogfood run was report-only, not writer;
- S6 failed-run recovery was dogfooded with a synthetic failed SDK run log under
  `/tmp`, not with a real failed SDK worker run;
- the runtime does not yet resume a thread by id; it only records a resume
  candidate in follow-up task instructions;
- the TypeScript SDK event surface reviewed in S4 did not expose a stable turn
  id, so richer turn-level lifecycle evidence would still require either
  optional metadata or a future App Server slice;
- SDK dependency and version movement add operational cost that the normal path
  does not need.

Normal-path promotion would make BK pay that cost before Samantha has enough
writer and recovery evidence.

### Rejection Gaps

Full rejection is also not justified:

- fake SDK tests are deterministic and do not need network or credentials;
- the live SDK report-only run preserved `HARNESS_RESULT`;
- the adapter boundary kept verification, scope checks, commits, reports,
  worktree allocation, and lifecycle decisions outside runtime code;
- `exec-json` fallback remains available as the baseline.

The SDK path has shown enough value to keep it available for bounded dogfood.

## Decision

Retain `codex-sdk` as an explicit experimental runtime.

Do not promote it to the normal path yet.
Do not remove it.
Do not add App Server integration.
Do not add a broader runtime selector.
Do not let SDK thread state drive verification, scope checks, commit/report
authority, lifecycle records, cleanup, or recovery decisions.

The default remains `exec-json`.

## Promotion Criteria For A Future Review

Reconsider promotion only after evidence includes all of the following:

- at least one bounded SDK writer run that produces a Samantha-owned commit
  after deterministic verification;
- at least one real failed SDK run recovered through `tasks:from-run`, with the
  follow-up task preserving fresh verification and authority boundaries;
- repeated evidence that SDK runtime errors are diagnosable from Samantha run
  logs without relying on hidden Codex UI state;
- no regression in exec-json command construction, worker dispatch, report-only
  dispatch, run log compatibility, or typecheck;
- a deliberate dependency/version maintenance plan for `@openai/codex-sdk`.

Until then, SDK runtime usage should stay deliberate and bounded.

## Authority Invariants

- Runtime metadata is evidence only.
- SDK thread ids are optional recovery context only.
- Runtime adapters own worker invocation and raw runtime output capture only.
- Samantha owns task specs, worktree allocation, scope checks, deterministic
  verification, report acceptance, commits, lifecycle records, cleanup, and
  push decisions.
- Workers and runtime adapters must not own orchestration or lifecycle
  transitions.

## Verification

- Reviewed S4 report-only capability spike:
  `references/initiatives/sdk-adapter-s4-report.md`.
- Reviewed S5 live SDK dogfood run:
  `runs/2026-05-16T04-48-50-868Z-fixture-report-reviewer.json`.
- Reviewed S5/S6 implementation surfaces:
  `src/core/worker-runtime-adapter.ts`, `src/core/worker-dispatch.ts`, and
  `src/core/task-from-run.ts`.
- Reviewed focused tests:
  `tests/worker-dispatch.test.ts`, `tests/codex-dispatch.test.ts`, and
  `tests/task-from-run.test.ts`.

