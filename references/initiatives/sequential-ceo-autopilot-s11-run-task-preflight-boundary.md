# Sequential CEO Autopilot S11 Run Task Preflight Boundary

Date: 2026-05-20

## Purpose

S11 is design-only and report-only. It defines how Sequential CEO Autopilot may
coordinate a future `run_task` candidate through existing run-task gates without
executing `run_task`, allocating worktrees, dispatching workers, mutating
lifecycle records, merging, cleaning up, committing, or pushing.

The boundary is a preflight-only report path. Continuation may inspect a closed
candidate object, validate it deterministically, and emit report evidence. It
must not turn prose, command strings, or roadmap text into executable work.

## Decision

Future `run_task` coordination should use one closed `runTaskCandidate` object
inside the continuation artifact instead of scattered top-level authority
fields.

The boundary must require a committed TaskSpec path, `requiredRuntime:
codex-sdk`, `executionMode: preflight_only`, Samantha-allocated isolated
worktree ownership, Samantha lifecycle ownership, target-file and
forbidden-change handoff, verify-command handoff, and deterministic
report-only output with side effects false.

Required shape:

```yaml
runTaskCandidate:
  taskSpecPath: references/tasks/<committed-task-spec>.md
  requiredRuntime: codex-sdk
  executionMode: preflight_only
  worktreeOwnership: samantha_allocated_isolated_worktree
  lifecycleOwner: samantha
  targetFiles:
    - <repo-relative target file>
  forbiddenChanges:
    - <repo-relative forbidden glob or path>
  verifyCommands:
    - <deterministic command handed to run-task gates>
  evidence:
    taskSpecCommit: <local commit containing the TaskSpec>
    taskSpecStatus: committed_clean
    freshnessEvidencePath: <repo-relative report or readiness evidence>
  expectedSideEffects:
    runTaskCalled: false
    workersDispatched: false
    worktreesCreated: false
    lifecycleMutated: false
    mergePerformed: false
    cleanupPerformed: false
    commitPerformed: false
    pushPerformed: false
```

Only fields inside `runTaskCandidate` may describe the future task candidate.
The parent continuation artifact may still carry its existing initiative,
slice, autonomy envelope, stop conditions, and `nextArtifactPath` fields, but
it must not duplicate or override candidate authority outside the object.

## Validation Order

The preflight report must validate in this order:

1. Validate the current continuation artifact before reading
   `runTaskCandidate`.
2. Reject when any current stop condition is active, including push
   requirements, stale evidence, dirty repo risk, hidden memory, daemon/watch
   behavior, remote adapters, dashboards, routine triggers, or broad roadmap
   execution.
3. Confirm the action is a reviewed `run_task` candidate and
   `executionMode` is exactly `preflight_only`.
4. Confirm `requiredRuntime` is exactly `codex-sdk`.
5. Normalize `taskSpecPath` as a repo-relative local file path.
6. Reject prose successors, shell command strings, URLs, absolute paths,
   traversal, glob expansion, empty paths, missing files, and off-repo paths.
7. Confirm the TaskSpec file is committed, clean, and not newer than the cited
   evidence. Dirty or uncommitted TaskSpecs stop preflight.
8. Parse the TaskSpec through existing run-task preflight rules without
   dispatching a worker.
9. Confirm Samantha owns isolated worktree allocation and lifecycle handling.
10. Compare the candidate `targetFiles`, `forbiddenChanges`, and
    `verifyCommands` against the TaskSpec handoff. Missing or conflicting
    handoff data blocks preflight.
11. Confirm all expected side-effect flags are false.
12. Emit deterministic report-only output: `accepted` with normalized fields,
    or `blocked` with ordered blocking reasons.

## Stop Conditions

Preflight must stop before any run-task execution path when any of these are
true:

- `runTaskCandidate` is missing, malformed, duplicated by top-level authority
  fields, or not tied to the current ready slice.
- The candidate is prose, a command string, a natural-language successor, a
  URL, an absolute path, a path traversal, a glob, or any off-repo path.
- `taskSpecPath` is missing, points at a missing file, points outside the repo,
  or names an uncommitted, dirty, or stale TaskSpec.
- `requiredRuntime` is absent or is not `codex-sdk`.
- `executionMode` is absent or is not `preflight_only`.
- The candidate requires continuation to allocate a worktree or dispatch a
  worker during preflight.
- Worktree ownership is not Samantha-allocated isolated ownership.
- Lifecycle ownership is not Samantha-owned.
- Target files, forbidden changes, or verify commands are absent, ambiguous,
  inconsistent with the TaskSpec, or outside existing run-task gates.
- Existing run-task preflight would reject the TaskSpec, agent profile,
  policy, repo cleanliness, stale base, target-file scope, forbidden changes,
  or deterministic verify commands.
- The current artifact or candidate evidence is stale, cyclic, invalid, or
  blocked by active stop conditions.
- Any path requires push, merge, cleanup, commit, daemon/watch behavior, remote
  adapters, dashboards, routine triggers, hidden memory, or broad roadmap
  execution.

## Evidence Requirements

An accepted preflight report must record:

- normalized `taskSpecPath`;
- `requiredRuntime: codex-sdk`;
- `executionMode: preflight_only`;
- Samantha-allocated isolated worktree ownership requirement;
- Samantha lifecycle ownership requirement;
- target-file handoff;
- forbidden-change handoff;
- verify-command handoff;
- cited committed TaskSpec evidence;
- freshness evidence used for the decision;
- ordered validation checks that passed;
- false side-effect flags for run-task execution, worker dispatch, worktree
  creation, lifecycle mutation, merge, cleanup, commit, and push.

A blocked preflight report must record:

- the candidate path or field that failed, when safe to report;
- ordered blocking reasons;
- the validation step that stopped inspection;
- false side-effect flags;
- no worker dispatch, worktree creation, lifecycle mutation, merge, cleanup,
  commit, or push.

## Non-Goals

- No `run_task` execution in S11.
- No `batch_plan` execution in S11.
- No worker dispatch by continuation.
- No worktree creation by continuation.
- No lifecycle mutation.
- No merge, cleanup, commit, or push.
- No daemon/watch service.
- No remote adapter.
- No dashboard.
- No routine trigger.
- No hidden memory.
- No broad roadmap execution.
- No source, test, task template, agent profile, package, policy, doctrine,
  Phase 5.5, Phase 5, run log, or worktree changes.

## Follow-Up Slices

- S12: implement deterministic `run_task` preflight report support for the
  closed `runTaskCandidate` object. It must not execute `run_task`.
- S13: dogfood S12 against committed TaskSpec candidates and blocked candidate
  cases. It must not execute `run_task`.
- S14: decide whether guarded single-`run_task` execution is justified after
  S12 and S13 evidence. Execution remains out of scope until that decision.

`batch_plan` coordination remains separate because it crosses Phase 5.5
`BatchPlanDraft` and Phase 5 `BatchSpec` gates.
