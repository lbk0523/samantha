# Sequential CEO Autopilot S17 Post-Run Lifecycle Boundary

Date: 2026-05-20

## Purpose

S17 is design-only. It defines how Sequential CEO Autopilot may inspect a
completed worker run after S16 without accepting, merging, cleaning up,
committing, pushing, dispatching another worker, or continuing to another
artifact.

S16 proved the guarded single-`run_task` path. It did not prove post-run
lifecycle authority. The worker candidate commit from S16 is still only run
evidence until Samantha passes reviewed accept, merge, lifecycle, and cleanup
gates.

## Evidence Reviewed

- S16 dogfood report:
  `references/operations/sequential-ceo-autopilot-s16-run-task-once-report.md`
- S16 run log:
  `runs/2026-05-20T07-50-20-478Z-sequential-ceo-autopilot-s16-dogfood-worker.json`
- S16 worker branch:
  `samantha/sequential-ceo-autopilot-s16-dogfood-worker`
- S16 worker candidate commit:
  `10b861c9023944d603fa6ac9bc041bb9715d0b18`
- S16 worker base commit:
  `86c940759f078607118ef15d851eb1e774e99cb0`
- Current main commit observed during S17 planning:
  `b37c5111361c57c50ceefd3e37062490cf47247e`

The S16 run passed worker evaluation, parsed `HARNESS_RESULT.status: pass`, had
no scope violations, and all declared verify commands exited `0`. The run is
not automatically acceptable now because the target main branch advanced after
the worker base commit. That stale-base condition should be reported by S18
preflight instead of being repaired implicitly.

## Existing Gate Decomposition

The existing `runs:accept` command is a compound lifecycle operation:

1. Evaluate the merge gate for one run log.
2. Record `merge_checked` into the run log trajectory.
3. Run the fast-forward merge command when the gate permits it.
4. Mark lifecycle `merged`.
5. Clean up the completed worker worktree.
6. Record cleanup into the run log trajectory.
7. Mark lifecycle `cleaned` when cleanup succeeds.
8. Draft accepted-run lesson evidence.

That is too much authority for S18. The next implementation slice must expose
report-only visibility first, without invoking any mutating command or helper.

## Decision

S18 should introduce a report-only preflight surface for one closed
`runAcceptCandidate` object. It should inspect whether a cited worker run log
would be eligible for a later guarded `runs:accept` execution, but it must not
perform the accept.

The preflight result may classify the candidate as:

- `accepted`: all checks pass and a later guarded accept execution would be
  allowed to attempt exactly one existing `runs:accept` operation;
- `blocked`: deterministic evidence says the candidate cannot be accepted in
  the current repo state;
- `absent`: no accept candidate is present;
- `rejected`: the continuation artifact is invalid before candidate
  inspection.

`accepted` here means accepted for report-only preflight, not merged into main.

## Candidate Shape

Future continuation artifacts should use one closed object:

```yaml
runAcceptCandidate:
  runLogPath: runs/example-run.json
  expectedRunId: 2026-05-20T07-50-20-478Z-example
  expectedTaskId: example-task
  expectedCommit: <worker candidate commit>
  expectedBaseCommit: <worker base commit>
  targetBranch: main
  requiredRuntime: codex-sdk
  executionMode: accept_preflight_only
  lifecycleOwner: samantha
  pushAllowed: false
  expectedSideEffects:
    runsAcceptCalled: false
    mergeGateRecorded: false
    mergePerformed: false
    lifecycleMutated: false
    cleanupPerformed: false
    commitPerformed: false
    pushPerformed: false
    runTaskCalled: false
    workersDispatched: false
    batchesExecuteCalled: false
    multiStepLoopStarted: false
    successorExecuted: false
```

The candidate must not contain shell commands, prose successors, lifecycle
shortcuts, retry instructions, rebase instructions, or cleanup instructions.

## Validation Order

S18 preflight must validate in this order:

1. Validate the current continuation artifact before reading
   `runAcceptCandidate`.
2. Reject active stop conditions and any push requirement.
3. Confirm the current slice is ready, the action type is the reviewed
   post-run accept preflight action, and dependencies are met.
4. Validate `runAcceptCandidate` as a closed object.
5. Normalize `runLogPath` as a repo-relative local `runs/*.json` path.
6. Reject command strings, prose paths, URLs, absolute paths, traversal,
   globs, environment expansion, missing files, off-repo files, invalid JSON,
   and mismatched run ids.
7. Parse the run log and compare `expectedRunId`, `expectedTaskId`,
   `expectedCommit`, `expectedBaseCommit`, `targetBranch`, and
   `requiredRuntime` against run evidence.
8. Require `result.pass: true`, parsed `HARNESS_RESULT.status: pass`, no scope
   violations, all declared verify commands with exit code `0`, and a present
   actionable worker candidate commit.
9. Confirm the target repo is on the target branch and has no uncommitted
   changes.
10. Confirm the worker candidate commit exists locally.
11. Confirm the candidate commit descends from the worker base commit.
12. Confirm the target branch HEAD still equals the worker base commit, unless
    the candidate is already integrated.
13. Report `stale_base` when target HEAD advanced after the worker base. Do
    not rebase, cherry-pick, rerun, or silently repair.
14. Report cleanup readiness only as evidence. Do not remove the worktree or
    delete the branch.
15. Emit deterministic JSON with trusted state changes false and mutating side
    effects false.

S18 must not call the existing `merge:check` CLI, because that command records
`merge_checked` into the run log trajectory. If code reuse is needed, use or
factor a pure helper that does not write run logs, lifecycle records, lesson
drafts, worktrees, branches, or commits.

## Stop Conditions

Stop before any accept execution when any of these are true:

- the current artifact is invalid;
- `runAcceptCandidate` is absent, malformed, not closed-schema, or mismatched
  to the current ready slice;
- `runLogPath` is prose, a command string, a URL, absolute, traversal, glob,
  environment-expanded, missing, invalid JSON, or off-repo;
- the run log id, task id, candidate commit, base commit, target branch, or
  runtime does not match the candidate;
- the run did not pass Samantha evaluation;
- `HARNESS_RESULT` is missing, malformed, or not `pass`;
- scope violations exist;
- declared verify commands are missing or failed;
- the worker candidate commit is missing or is not descended from the worker
  base;
- the target repo is dirty or not on the target branch;
- target HEAD advanced after the worker base and the worker commit is not
  already integrated;
- cleanup would remove the main worktree, operate on a dirty worker worktree,
  or delete a branch before merge evidence exists;
- any path requires push, hidden memory, daemon/watch behavior, remote
  adapters, dashboards, routine triggers, batch execution, worker dispatch,
  multi-step continuation, or successor execution.

## S16 Fixture Decision

The S16 run should not be accepted or cleaned up manually in S17. It is useful
as a blocked stale-base fixture for S18 because:

- the worker base commit is `86c940759f078607118ef15d851eb1e774e99cb0`;
- main is currently `b37c5111361c57c50ceefd3e37062490cf47247e`;
- the worker candidate commit is not integrated into main; and
- a correct report-only accept preflight should block on stale base without
  mutating run logs or lifecycle state.

If S18 needs an accepted-path fixture, create a separate small fresh run or an
injected core test fixture. Do not force S16 through accept just to obtain an
accepted-path example.

## Non-Goals

- No source or test implementation in S17.
- No `runs:accept` execution in S17 or S18.
- No `merge:check` CLI execution from continuation preflight.
- No run log trajectory mutation in S18.
- No lifecycle JSONL mutation in S18.
- No worktree cleanup in S18.
- No branch deletion in S18.
- No mainline merge in S18.
- No local mainline commit or push in S18.
- No `run_task` execution in S18.
- No `batch_plan` execution in S18.
- No worker dispatch in S18.
- No multi-step loop or successor execution in S18.
- No daemon/watch behavior.
- No remote adapter.
- No dashboard.
- No routine trigger.
- No hidden memory.
- No broad roadmap execution.

## Follow-Up Slices

- S18: implement report-only `runs:accept` preflight visibility for one
  `runAcceptCandidate`. It must be pure visibility and must not mutate run
  logs, lifecycle state, worktrees, branches, or main.
- S19: dogfood S18 against one accepted-path fixture and one blocked fixture.
  The S16 stale-base run is a valid blocked fixture.
- S20: implement guarded single `runs:accept` execution only after S18/S19
  prove the preflight surface.
- S21: dogfood S20 through one accepted run lifecycle.
- S22: connect post-accept status update and deterministic next-artifact
  reporting from accepted lifecycle evidence.
- S23: dogfood one end-to-end writer continuation cycle.
- S24: decide MVP closure versus a separate follow-up initiative.

## Verification Strategy

S17 verification is documentation-only:

- confirm this boundary artifact exists;
- confirm the S17 operation report exists;
- confirm the initiative marks S17 completed and S18 ready;
- run the initiative readiness check;
- run scoped markdown diff checks;
- verify no `src` or `tests` files changed;
- verify no `runs:accept`, `merge:check`, `worktree:cleanup`,
  `runs:mark-lifecycle`, `run_task`, `batch_plan`, worker dispatch, merge,
  cleanup, commit, push, multi-step loop, or successor execution occurred.
