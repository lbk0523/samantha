# Phase 5 Writer Batch Execution Design

Status: reviewed design artifact; execution baseline implemented in
`src/core/batch-execution.ts` and exposed through `batches:execute`.

This document defines the reviewed batch design Samantha needs for writer batch
execution. It starts after the `BatchSpec` contract and preflight gates have
accepted a batch plan. The implemented baseline still does not authorize
worker-owned orchestration, worker-owned rebase, worker-owned cleanup,
`writerCap` changes, or automatic source `BatchSpec` lifecycle mutation. The
only implemented source mutation is explicit Samantha-owned rejection through
`batches:reject`.

## Current Implemented Baseline

The Phase 5 planning surface already covers:

- `BatchSpec` artifact store and stable lookup by `batchId`
- path and id preflight
- referenced `TaskSpec` parsing and declaration matching
- write-set and forbidden-change preflight
- serial-only classification and single-member serial dispatch groups
- git `baseCommit` resolution and target `HEAD` equality gate
- verification and lifecycle policy contract validation
- CLI preflight that reports whether a batch may dispatch

Those gates prove that a batch is a valid plan. They do not run workers or
integrate candidates.

## Implementation Gate

Before any execution code is added, a future implementation task must keep these
gates explicit and Samantha-owned:

1. Re-run `BatchSpec` preflight immediately before dispatch.
   - Input: immutable `BatchSpec` loaded from the artifact store by `batchId`.
   - Gate: preflight must still pass against the current repo `HEAD`.
   - Stop: stale `baseCommit`, missing task spec, changed task declaration,
     overlapping write set, serial-only violation, or invalid verification
     policy.
2. Create worker worktrees only from `baseCommit`.
   - Input: tasks eligible for the next dispatch group.
   - Gate: each worktree records the same base commit and the owning `taskId`.
   - Stop: worktree allocation from any other commit.
3. Dispatch only dependency-ready tasks.
   - Input: dependency DAG and `integrationQueue`.
   - Gate: a task can dispatch only when every direct dependency is already
     accepted or explicitly represented as an integrated prerequisite outside
     the batch.
   - Stop: dependency failure blocks all transitive dependents until replanned.
4. Preserve serial-only handling.
   - Input: `serialOnlyRules`, normalized target files, and dispatch groups.
   - Gate: contracts, policy, package metadata, lockfiles, task templates, agent
     profiles, and doctrine documents stay single-member serial groups.
   - Stop: authority-boundary changes leave the writer batch path and become a
     separate doctrine or policy task with focused review.
5. Record independent worker evidence.
   - Input: one worker run per dispatched `taskId`.
   - Gate: each worker produces a normal writer run log and candidate commit.
   - Stop: missing `HARNESS_RESULT`, failed verification, out-of-scope changes,
     dirty worktree, or absent candidate commit.
6. Integrate only through the ordered Samantha queue.
   - Input: `integrationQueue`, run logs, and candidate commits.
   - Gate: `expectedCandidateCommit` must match the run log candidate before
     integration, and queue order remains Samantha-owned.
   - Stop: worker output, report text, or `HARNESS_RESULT` cannot mutate queue
     order.
7. Verify after each accepted candidate.
   - Input: the accepted queue item.
   - Gate: run `focusedVerifyCommands` in the target repo after integration.
   - Stop: failed focused verification rejects or rolls back that candidate
     before the next queue item is considered.
8. Verify the whole accepted batch.
   - Input: all accepted candidates integrated in order.
   - Gate: run `verification.afterFinalAcceptedMerge`.
   - Stop: failed final verification blocks batch completion and cleanup.
9. Resolve stale base and rebase explicitly.
   - Input: target repo `HEAD`, `baseCommit`, candidate branches, and run logs.
   - Gate: if `HEAD` differs from `baseCommit`, no candidate is accepted until
     Samantha creates a new explicit plan or performs a Samantha-owned rebase
     with fresh evidence.
   - Stop: worker-owned rebase or reusing old verification after rebase.
10. Handle partial failure without contaminating accepted work.
    - Input: dependency graph, run status, and queue position.
    - Gate: failed tasks block dependents; independent passed candidates may
      remain eligible only if dependency, write-set, base, and verification gates
      still hold.
    - Stop: failed output cannot become a trusted base or merge input.
11. Clean up only after terminal decisions.
    - Input: per-worker run log and lifecycle decision.
    - Gate: cleanup requires accepted, rejected, superseded, or abandoned
      terminal evidence for each worker.
    - Stop: dirty, unresolved, unintegrated, or missing worktree evidence.

## Batch Identity And Dependencies

Every execution record must preserve:

- `batchId`
- `baseCommit`
- `taskId`
- `taskSpecPath`
- dispatch group
- dependency edges that made the task eligible
- integration queue position
- terminal decision

The dependency graph is authoritative for dispatch eligibility. The integration
queue is authoritative for merge order. A worker can produce evidence only; it
cannot add dependencies, delete dependencies, or reorder candidates.

## Write-Set And Serial-Only Gates

Preflight write-set proof must be carried into execution records instead of
recomputed from worker output. The allowed execution path is:

```text
BatchSpec declared write sets
-> deterministic preflight proof
-> dispatch group eligibility
-> candidate scope check against the original TaskSpec
-> focused verification after integration
```

Serial-only tasks may be planned in a batch artifact, but they must execute as a
single-member dispatch group. A serial-only target that changes an authority
boundary is not a routine writer batch item; it requires the relevant doctrine or
policy workflow before implementation.

## Worker Run Logs And Candidate Commits

Each dispatched task must produce one independent writer run log. The run log is
the only source for:

- worker status
- changed files
- verification results inside the worker run
- candidate commit hash
- dirty-worktree evidence
- scope violations

A candidate commit is merge-eligible only after ordinary writer gates pass. A
passing worker run is still not trusted final state; it is only a candidate for
Samantha-owned integration.

## Ordered Samantha-Owned Integration

Integration must process `integrationQueue` in ascending `order`.

For each queue item:

1. Confirm all `requiresAccepted` entries are accepted.
2. Confirm the candidate commit matches the run log evidence.
3. Confirm the target repo is still at the expected integration base.
4. Apply the candidate through a Samantha-owned merge or cherry-pick gate.
5. Run the queue item's focused verification commands.
6. Record the accepted or rejected decision before considering the next item.

After the final accepted item, Samantha runs the batch final verification
commands. A batch is complete only after final verification passes and lifecycle
records show all workers have terminal decisions.

## Stale Base, Rebase, Partial Failure, And Cleanup

Stale base policy is `block_and_replan`. If the target repo advances before
dispatch or during integration, Samantha stops candidate acceptance and records
terminal replan evidence in `batch-replan-evidence.jsonl`. That evidence
includes the source batch id, source `baseCommit`, observed `HEAD`, trigger,
violations, and `sourceBatchSpecMutation: "not_performed"`.

The implemented closure does not automatically create the replacement
`BatchSpec`. Automatic replacement planning remains deferred because choosing a
new integration queue, status model, and lifecycle state is a product authority
decision.

Rebase policy is `explicit_samantha_owned_rebase_only`. A rebase creates new
candidate evidence and must rerun scope and verification gates. Workers do not
rebase batch branches. Samantha-owned rebase execution remains deferred until a
reviewed rebase plan/evidence contract exists; old verification must not be
reused after any future rebase path.

Partial failure policy is
`block_dependents_allow_independent_candidates`. Failed tasks block dependents,
but independent passed candidates can remain eligible when the original
dependency, write-set, serial-only, base, and verification gates still hold.

Cleanup policy is `explicit_per_worker_lifecycle_after_resolution`. Cleanup can
run only after every worker has a terminal decision recorded. Cleanup execution
must reject unresolved, dirty, missing, or unintegrated worker worktrees.

## Implemented Baseline

The execution baseline now implements:

- writer batch dispatch
- worker worktree creation for batch execution
- candidate commit merge or cherry-pick execution
- merge queue execution
- focused verification execution after candidate integration
- final batch verification execution
- partial-failure status transitions
- stale-base `block_and_replan` terminal evidence
- cleanup execution

These items remain deliberately outside the routine baseline:

- raising `writerCap`
- worker-owned orchestration, rebase, merge order, cleanup, or lifecycle
  mutation
- automatic stale-base generation of a replacement `BatchSpec`
- Samantha-owned rebase execution until a reviewed rebase task and evidence
  contract exists
- source `BatchSpec` task status, candidate evidence, `integrationQueue`, or
  non-rejected lifecycle mutation until a reviewed Samantha-owned mutation
  contract exists

## Source BatchSpec Rejection Mutation

The implemented mutation surface is intentionally narrow:

```text
batches:reject
-> validate the current source BatchSpec
-> set only top-level status to rejected
-> validate the mutated BatchSpec
-> write before/after audit evidence to batch-lifecycle-audit.jsonl
```

`batches:reject` is Samantha-owned lifecycle closure for an invalidated or
abandoned source plan. It does not consume worker output or `HARNESS_RESULT`, it
does not update task statuses, it does not fill `runLogPath` or
`candidateCommit`, and it does not reorder or mark `integrationQueue` entries.
Execution paths such as stale-base preflight/integration still record
`sourceBatchSpecMutation: "not_performed"` unless this explicit command is run
afterward.

## Stop Conditions For Implementation Work

Future implementation must stop before crossing any of these boundaries:

- changing Samantha's authority model
- allowing workers to own orchestration, rebase, merge order, cleanup, or
  lifecycle mutation
- treating worker or report output as trusted state
- raising `writerCap` without reviewed batch orchestration
- implementing writer dispatch, merge, cleanup, or status mutation in a task
  that was scoped only to design or preflight
- changing contracts, policy, task templates, agent profiles, or doctrine
  without the matching focused tests or reviewed documentation path
