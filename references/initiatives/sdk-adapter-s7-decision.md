# SDK Adapter S7 Promotion Decision

Date: 2026-05-16
Status: completed; refreshed by S10
Decision: S7 retained `codex-sdk` as an explicit experimental runtime; S10
promotes it to preferred dogfood runtime for Samantha self-build tasks only

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

## Additional Dogfood Verification

After the initial S7 decision, BK requested the missing verification work. The
following live SDK runs were completed on 2026-05-16:

| Run | Outcome | Evidence |
| --- | --- | --- |
| `2026-05-16T05-12-54-588Z-sdk-writer-dogfood` | pass | SDK writer run created Samantha-owned commit `93974ae6d4606c85a835370846aec6e44b879961`, later accepted and cleaned. |
| `2026-05-16T05-15-18-040Z-sdk-failed-recovery-dogfood` | verify_failed | Real SDK run preserved `threadId` `019e2f35-d859-7502-8c09-56b364b0cf4b`, changed only the declared target file, and failed only the declared verify command. |
| `2026-05-16T05-16-42-812Z-sdk-failed-recovery-follow-up` | pass | `tasks:from-run` generated a bounded follow-up task that kept the failed verify command and SDK thread id as optional context; the follow-up SDK run created Samantha-owned commit `1423d4ae1e07176a937567edaa0d997781acf83e`, later accepted and cleaned. |

This upgrades the implementation evidence:

- SDK writer execution has now produced and accepted a Samantha-owned commit.
- Real SDK failed-run recovery has now gone through `tasks:from-run` and a
  passing follow-up run.
- SDK thread continuity remained optional context; the follow-up task spec,
  target files, forbidden changes, and verify command stayed authoritative.
- Existing lifecycle and cleanup authority remained Samantha-owned.

The decision still does not promote SDK to the default runtime. The remaining
promotion gaps are repeated runtime-error diagnosability evidence and an
explicit dependency/version maintenance plan for `@openai/codex-sdk`. The S10
refresh below supersedes this gap statement after S8 and S9 completion.

## S10 Promotion Decision Refresh

Date: 2026-05-16

Decision: promote `codex-sdk` from explicit experimental runtime to preferred
dogfood runtime for Samantha self-build tasks only.

This is a documentation-only status decision. It does not change the CLI
default, runtime selector behavior, batch/report orchestration, App Server
integration, lifecycle authority, verification authority, scope authority,
commit authority, cleanup authority, push authority, or recovery authority.

`exec-json` remains the default `run-task` runtime. `codex-sdk` remains
available only through explicit selection, currently `run-task
--runtime=codex-sdk`, until a later implementation slice changes operator or
task authoring guidance.

### Evidence Used

S10 uses the S7 evidence plus the completed S8 and S9 follow-up evidence:

- S8 added fake SDK runtime coverage for `turn.failed`, stream `error`, and
  thrown SDK/client exceptions in `tests/worker-dispatch.test.ts`.
- S8 changed thrown SDK/client exceptions to include a diagnosable
  `codex-sdk runtime failed:` stderr prefix.
- S8 ran a bounded live SDK runtime failure dogfood under
  `/tmp/samantha-s8-sdk-runtime-error-runs/2026-05-16T05-46-46-684Z-fixture-report-reviewer.json`.
  The run log recorded `exitCode` 1, `runtime.kind` `codex-sdk`, empty event
  counts, no thread id because the subprocess failed before `thread.started`,
  and no Samantha-owned commit.
- S9 added `references/initiatives/sdk-adapter-s9-dependency-policy.md`,
  defining exact SDK pinning, SDK/bundled-Codex version coupling, external CLI
  separation, upgrade smoke tests, rollback criteria, and BK approval
  boundaries.

The two S7 promotion gaps are now addressed well enough for preferred dogfood
use:

- SDK runtime errors are diagnosable from Samantha run logs without hidden Codex
  UI state or App Server state.
- SDK dependency and version maintenance has a reviewable policy.

This evidence is still not enough for CLI default promotion. Default promotion
would change routine worker behavior for every `run-task` invocation, and S10
does not include that approval or implementation scope.

### Runtime Status Matrix

| Status | Default runtime | Allowed explicit runtimes | Fallback path | Rollback trigger | Evidence required |
| --- | --- | --- | --- | --- | --- |
| Baseline default | `exec-json` | `exec-json`, `codex-sdk` | Use `exec-json` by omitting `--runtime` or passing `--runtime=exec-json`. | Baseline regression in command construction, worker dispatch, run logs, or typecheck. | Existing exec-json command construction tests, worker-dispatch tests, run-log compatibility, typecheck. |
| Preferred dogfood runtime for Samantha self-build | `exec-json` | `exec-json`, `codex-sdk` | Use `exec-json` explicitly when SDK dogfood fails, when credentials/local SDK state are unsuitable, or when the task is not a bounded self-build dogfood task. | SDK runtime errors stop being diagnosable from run logs; `HARNESS_RESULT` preservation regresses; SDK metadata loses `runtime.kind`; SDK behavior pressures Samantha-owned gates into the runtime adapter; bounded SDK dogfood writes outside declared authority. | S7 writer/recovery dogfood evidence; S8 fake and live runtime-failure evidence; S9 dependency policy; focused dispatch/runtime tests; typecheck. |
| CLI default candidate | `codex-sdk` | `codex-sdk`, `exec-json` | Pass `--runtime=exec-json` for rollback or incompatible tasks. | Any regression in normal-path reliability, failure diagnosis, dependency maintenance, or authority boundaries. | Separate BK approval; repeated successful preferred-dogfood runs; no regression in full test suite; documented rollback path; no App Server or broader selector dependency. |

Selected S10 status: preferred dogfood runtime for Samantha self-build tasks
only, while keeping `exec-json` as the CLI default.

### Rollback Criteria

Rollback from preferred dogfood status to explicit experimental status if any
of these occur:

- fake SDK success or failure coverage regresses;
- live SDK runtime failures cannot be diagnosed from Samantha run logs;
- SDK runs require hidden Codex UI state or App Server state for diagnosis;
- `HARNESS_RESULT` output no longer flows through Samantha-owned evaluation;
- SDK thread state starts driving task specs, verification, scope checks,
  commits, lifecycle records, cleanup, push, recovery, or orchestration;
- SDK package movement violates the S9 dependency policy;
- bounded SDK dogfood produces production writes outside declared task
  authority.

Rollback means keeping `exec-json` as the default, avoiding SDK-preferred
dogfood guidance, and using `codex-sdk` only for explicitly requested
experimental runs until the regression has a reviewed fix.

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
- Reviewed S8 runtime error diagnosability evidence:
  commit `53d7f0f` and
  `/tmp/samantha-s8-sdk-runtime-error-runs/2026-05-16T05-46-46-684Z-fixture-report-reviewer.json`.
- Reviewed S9 dependency policy:
  `references/initiatives/sdk-adapter-s9-dependency-policy.md`.
