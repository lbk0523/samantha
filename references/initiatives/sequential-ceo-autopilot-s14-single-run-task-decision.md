# Sequential CEO Autopilot S14 Single Run Task Decision

Date: 2026-05-20

## Evidence Reviewed

- S10 action coordination boundary:
  `references/initiatives/sequential-ceo-autopilot-s10-action-coordination-boundary.md`.
  S10 proved only report-only next-artifact linkage and required future
  `run_task` coordination to preserve committed TaskSpecs, existing run-task
  gates, SDK runtime, Samantha-allocated isolated worktrees, `HARNESS_RESULT`,
  scope checks, deterministic verification, and Samantha-owned lifecycle gates.
- S11 run-task preflight boundary:
  `references/initiatives/sequential-ceo-autopilot-s11-run-task-preflight-boundary.md`.
  S11 defined a closed `runTaskCandidate` object with `requiredRuntime:
  codex-sdk`, `executionMode: preflight_only`, committed-clean TaskSpec
  evidence, false side-effect flags, and report-only validation.
- S12/S12.1 evidence in
  `references/initiatives/sequential-ceo-autopilot.md`. S12 implemented
  deterministic `runTaskPreflight` visibility without calling `run_task`,
  dispatching workers, creating worktrees, mutating lifecycle state, merging,
  cleaning up, committing, or pushing. S12.1 corrected preflight ordering so
  invalid predecessor artifacts block before absent, null, or malformed
  `runTaskCandidate` handling.
- S13 dogfood report:
  `references/operations/sequential-ceo-autopilot-s13-run-task-preflight-report.md`.
  S13 observed an accepted preflight for the committed-clean S12 TaskSpec with
  `requiredRuntime: codex-sdk` and a blocked preflight for the same candidate
  with `requiredRuntime: exec-json`.

## Decision

Guarded single run_task execution is justified as the next implementation
slice, but S14 itself remains decision/design-only.

The justification is narrow: S12/S12.1 provide deterministic preflight behavior,
and S13 proves that the preflight can accept a committed-clean SDK candidate and
block a runtime violation without side effects. That is enough evidence to
design S15 as exactly one explicit `run_task` execution path through existing
Samantha gates.

`preflight_only` remains report-only and cannot itself trigger execution. Any
future execution-enabling field or command must be explicit and reviewed before
it can call `run_task`.

## Allowed Future Execution Shape

S15 may implement only this shape:

1. Consume exactly one explicit `run_task` action.
2. Require accepted `runTaskPreflight` evidence for the same TaskSpec and
   current ready slice.
3. Use the existing run-task gates.
4. Require SDK runtime.
5. Require a committed-clean TaskSpec.
6. Require a Samantha-allocated isolated worktree.
7. Execute the worker once and require `HARNESS_RESULT`.
8. Run deterministic verification from the TaskSpec.
9. Record run log/report evidence with `pushPerformed: false`.
10. Stop immediately after the run log/report.

The stop after the run log/report happens before any accept, merge, cleanup,
commit, push, `batch_plan`, multi-step loop, successor execution, or broader
roadmap execution.

## Required Artifact Fields

The future continuation artifact must carry an explicit execution-enabling
object or command distinct from `runTaskCandidate`. The reviewed shape should
include these fields:

- current initiative id and current ready slice id;
- action type exactly `run_task`;
- execution mode exactly `single_run_task`;
- `taskSpecPath` as a normalized repo-relative local
  `references/tasks/*.json` path;
- `requiredRuntime: codex-sdk`;
- accepted preflight evidence path, status, and candidate identity;
- `taskSpecStatus: committed_clean`;
- `worktreePolicy: samantha_allocated_isolated`;
- `lifecycleOwner: samantha`;
- target-file handoff copied from the TaskSpec;
- forbidden-change handoff copied from the TaskSpec;
- deterministic verify-command handoff copied from the TaskSpec;
- `pushAllowed: false`;
- expected execution effects allowing one run-task call, one worker dispatch,
  one Samantha-owned worktree allocation, one run log/report, and deterministic
  verification;
- expected blocked effects for accept, merge, cleanup, commit, push,
  `batch_plan`, multi-step loop execution, successor execution, daemon/watch,
  remote adapter, dashboard, routine trigger, hidden memory, and broad roadmap
  execution.

## Validation And Execution Order

1. Validate the current continuation artifact before inspecting execution
   fields.
2. Reject missing, malformed, stale, cyclic, off-repo, or invalid artifacts.
3. Confirm there is exactly one explicit execution-enabling `run_task` action.
4. Reject `preflight_only` as an execution trigger.
5. Confirm no active stop condition, no push requirement, and no multi-step or
   successor execution request.
6. Load accepted `runTaskPreflight` evidence and confirm it matches the current
   ready slice, TaskSpec path, runtime, handoff fields, and freshness evidence.
7. Re-run or invoke existing run-task preflight gates before worker dispatch.
8. Confirm the TaskSpec is tracked, committed-clean, and not stale relative to
   the cited evidence.
9. Allocate the isolated worktree through Samantha-owned run-task gates.
10. Execute exactly one worker run with SDK runtime.
11. Require `HARNESS_RESULT`.
12. Check changed-file scope against target files and forbidden changes.
13. Run deterministic verification commands.
14. Write run log/report evidence with false push and blocked lifecycle effects.
15. Stop immediately before accept, merge, cleanup, commit, push, `batch_plan`,
    multi-step loop, or successor execution.

## Stop Conditions

Stop before execution when any of these are true:

- execution is inferred from prose, command strings, markdown roadmap text, or
  `preflight_only`;
- more than one `run_task` action is present;
- the action requests `batch_plan`, multi-step looping, successor execution,
  accept, merge, cleanup, commit, push, daemon/watch behavior, remote adapters,
  dashboards, routine triggers, hidden memory, or broad roadmap execution;
- accepted `runTaskPreflight` evidence is missing, blocked, stale, mismatched,
  or not tied to the current ready slice;
- `requiredRuntime` is not `codex-sdk`;
- the TaskSpec is missing, off-repo, untracked, uncommitted, dirty, stale, or
  inconsistent with target files, forbidden changes, or verify commands;
- existing run-task gates reject the TaskSpec, agent profile, repo cleanliness,
  policy checks, stale-base checks, target-file scope, forbidden changes, or
  deterministic verify commands;
- the worker run lacks valid `HARNESS_RESULT`;
- changed-file scope checks fail;
- deterministic verification fails and the existing allowed rework path is not
  explicitly selected by Samantha.

## Evidence And Lifecycle Requirements

An accepted S15 run must leave reviewable evidence containing:

- normalized TaskSpec path;
- accepted preflight evidence path and status;
- runtime kind `codex-sdk`;
- Samantha-owned isolated worktree path;
- run log/report path;
- `HARNESS_RESULT`;
- changed-file scope result;
- deterministic verification command output;
- `pushPerformed: false`;
- explicit stop reason after the run log/report;
- explicit false lifecycle effects for accept, merge, cleanup, commit, push,
  `batch_plan`, multi-step loop, successor execution, daemon/watch, remote
  adapter, dashboard, routine trigger, hidden memory, and broad roadmap
  execution.

Continuation must not mark the work accepted, merged, cleaned up, committed, or
pushed in the same slice. Those lifecycle transitions require a separate
reviewed artifact and gate.

## Non-Goals

- No `run_task` execution in S14.
- No `batch_plan` execution in S14 or S15.
- No execution triggered by `preflight_only`.
- No worker dispatch by continuation in S14.
- No worktree creation by continuation in S14.
- No lifecycle mutation by continuation in S14.
- No accept, merge, cleanup, commit, or push by continuation in S14.
- No multi-step loop or successor execution in the guarded single-run slice.
- No daemon/watch behavior.
- No remote adapter.
- No dashboard.
- No routine trigger.
- No hidden memory.
- No broad roadmap execution.
- No source, test, task template, agent profile, package, policy, doctrine,
  Phase 5.5, Phase 5, run log, or worktree changes in S14.

## Follow-Up Slices

- S15: implement guarded single-`run_task` execution only, using the explicit
  execution-enabling field or command described above. S15 must still stop
  immediately after run log/report evidence.
- Later, not ready: dogfood the S15 guarded execution path against one bounded
  committed-clean TaskSpec.
- Later, not ready: design any accept, merge, cleanup, or local commit
  continuation boundary only after guarded execution evidence exists.

## Rejected Alternatives

- Execute `run_task` in S14. Rejected because S14 is the reviewed decision
  boundary, not the implementation or execution slice.
- Let `executionMode: preflight_only` trigger execution. Rejected because
  preflight is report-only evidence.
- Infer execution from markdown prose, next prompts, or shell command strings.
  Rejected because trusted continuation must come from closed-schema artifacts
  and deterministic gates.
- Combine `batch_plan` coordination with guarded `run_task`. Rejected because
  batch coordination crosses Phase 5.5 and Phase 5 boundaries.
- Continue into accept, merge, cleanup, commit, push, successor execution, or a
  multi-step loop after one worker run. Rejected because S15 only earns run
  evidence, not lifecycle authority.
- Let continuation allocate worktrees, mutate lifecycle state, or merge outside
  existing Samantha gates. Rejected because Samantha owns those gates.

## Verification Strategy

S14 verification is documentation-only:

- confirm this decision/design artifact exists;
- confirm the S14 operation report exists;
- grep for the decision and guarded single run_task language;
- run the initiative readiness check;
- run scoped markdown diff checks for the three S14 target files;
- verify no `src` or `tests` files changed.

S15 verification should add focused deterministic tests for accepted and
blocked execution artifacts, CLI behavior, false push, immediate stop after run
log/report, and rejection of `preflight_only` as an execution trigger.
