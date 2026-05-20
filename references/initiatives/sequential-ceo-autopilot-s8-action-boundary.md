# Sequential CEO Autopilot S8 Action Boundary

Date: 2026-05-20

## Problem From S7 Evidence

S7 proved the readiness-only loop can consume a structured continuation artifact,
run one deterministic readiness step, accept status evidence, update the
artifact, and preserve false side-effect flags for worker dispatch, worktrees,
run-task, batch execution, and push.

S7 also exposed the correct stop: `no_deterministic_next_artifact`. The current
contract can update the current artifact, but it cannot name the next trusted
artifact. Broader routine use is unsafe until successor artifacts are linked by
closed-schema fields and validated independently.

The S7 run also left `run_task` and `batch_plan` as vocabulary entries only.
They need a reviewed action-execution boundary before the continuation loop can
coordinate those action types without bypassing Samantha's existing lifecycle
authority.

## Accepted Boundary Decisions

- Continuation may select the next safe slice only from validated structured
  artifacts and cited local evidence.
- Next artifacts are never inferred from markdown prose or command strings.
  Any next linkage must be a closed-schema explicit local path such as
  `nextArtifactPath`, or an equivalent reviewed field with the same validation
  semantics.
- A named next artifact must validate independently before execution. The
  current artifact cannot lend trust to the successor.
- Missing files, off-repo paths, path traversal, cycles, stale evidence, dirty
  repo risk, active stop conditions, and push requirements stop continuation.
- `run_task` continuation may coordinate an existing reviewed run-task gate, but
  it must not own worker execution authority.
- `batch_plan` continuation may coordinate reviewed Phase 5.5 and Phase 5 gates,
  but it must not replace draft review, preparation, preflight, worker
  execution, integration, lifecycle recording, or cleanup.
- S8 is documentation-only. Any validator, CLI, or execution behavior belongs
  to later reviewed slices.

## Next-Artifact Linkage Contract

The structured continuation artifact should add an explicit successor linkage:

```yaml
schemaVersion: 1
initiativePath: references/initiatives/<initiative>.md
currentSlice:
  id: S8
  status: completed
  actionType: report_only
evidenceReferences:
  - references/initiatives/sequential-ceo-autopilot-s8-action-boundary.md
nextArtifactPath: references/operations/<initiative>-s9-continuation.json
nextArtifactExpectedSliceId: S9
stopConditions:
  active: []
pushAllowed: false
```

`nextArtifactPath` is the preferred field name for the next slice. If a later
reviewed design chooses a different name, it must preserve the same contract:
one explicit local path field, not prose extraction and not command parsing.

Validation gates:

1. Validate the current artifact with the existing continuation schema before
   reading successor fields.
2. Accept the current slice status only from cited deterministic evidence.
3. If `nextArtifactPath` is absent or `null`, stop with
   `no_deterministic_next_artifact`.
4. If `nextArtifactPath` is present, require a normalized repo-relative local
   path. Reject absolute paths, URLs, shell commands, globs, path traversal,
   environment expansion, and paths outside the repo.
5. Require the target file to exist before continuation. Missing files stop.
6. Validate the next artifact independently before executing anything from it.
7. Require the next artifact to cite the same `initiativePath`, name the
   expected next slice through `currentSlice.id`, and carry no active stop
   condition.
8. Detect cycles within one continuation run by tracking visited artifact paths
   and slice ids. Any repeat stops continuation.
9. Treat stale evidence as a stop condition when the successor's dependency
   evidence does not cite the just-accepted slice evidence, the referenced
   evidence path is missing, or the repo state no longer matches the evidence
   base expected by the successor.
10. Preserve `pushAllowed: false`. Any successor requiring push stops.

This contract deliberately links artifacts, not commands. A field containing
`bun run ...`, `sam c: ...`, or roadmap prose is invalid for next linkage.

## run_task Action Contract

A `run_task` action is valid only when the continuation artifact names a
committed task spec and delegates execution to existing Samantha run-task gates.
The artifact should use concrete fields such as:

```yaml
actionType: run_task
taskSpecPath: references/tasks/example-task.json
requiredRuntime: codex-sdk
worktreePolicy: isolated
verifyCommands:
  - bun test <focused-test>
changedFileScope:
  targetFiles: []
  forbiddenChanges: []
lifecycleOwner: samantha
pushAllowed: false
```

Required gates:

1. `taskSpecPath` must resolve to an existing committed TaskSpec path in the
   local repo. Untracked, generated-only, missing, or off-repo task specs stop.
2. Existing run-task preflight must pass, including agent profile, target files,
   forbidden changes, verify commands, repo cleanliness, stale-base checks, and
   policy checks.
3. Execution must use SDK runtime: `requiredRuntime: codex-sdk`.
4. Samantha, not the continuation worker, allocates the isolated worktree.
5. The worker run must produce `HARNESS_RESULT`.
6. Samantha checks changed-file scope against the task spec before acceptance.
7. Deterministic verify commands from the task spec must run and pass, or the
   action enters the existing rework/blocked path.
8. Samantha owns accept, merge, lifecycle record, cleanup, and local commit
   gates. Continuation may read the resulting evidence and choose the next
   artifact only after those gates pass.

Continuation may coordinate the next `run_task` action, but it must not bypass
or own worker execution authority.

## batch_plan Action Contract

A `batch_plan` action is valid only as a coordinator for reviewed existing batch
gates. The artifact should name the current batch boundary explicitly, for
example:

```yaml
actionType: batch_plan
batchStage: draft_review | prepare | preflight | execute | integrate | cleanup
batchPlanDraftPath: references/batch-plans/<draft-id>.json
batchSpecPath: references/batch-specs/<batch-id>.json
requiredGates:
  - phase-5-5-draft-review
  - phase-5-preflight
  - disjoint-write-set-proof
  - serial-only-handling
pushAllowed: false
```

Required gates:

1. A Phase 5.5 `BatchPlanDraft` remains planning evidence only until reviewed.
2. Promotion to Phase 5 requires the existing preparation gate and a concrete
   `BatchSpec`.
3. Preflight must prove disjoint write sets and identify serial-only files such
   as contracts, policy, package metadata, lockfiles, task templates, agent
   profiles, and doctrine documents.
4. Worker execution remains Samantha-owned. Workers must not spawn, coordinate,
   or delegate to subagents.
5. Each worker run must leave independent run evidence and `HARNESS_RESULT`.
6. Integration must be ordered by Samantha, with focused verification after each
   accepted merge and broader verification after the final accepted merge.
7. Lifecycle records, partial-failure handling, stale-base handling, cleanup,
   and local commit/report gates remain existing Samantha responsibilities.

Continuation may only invoke reviewed existing gates. It must not replace draft
review, preparation, preflight, disjoint write-set proof, serial-only handling,
worker execution, integration, lifecycle, or cleanup.

## Phase 5.5 / Phase 5 Boundary Preservation

S8 preserves the Phase 5.5 `BatchPlanDraft` boundary. A draft can explain a
candidate batch and its intended slices, but it cannot dispatch workers,
authorize merges, prove write-set safety, or mutate lifecycle state.

S8 also preserves the Phase 5 `BatchSpec` boundary. A prepared batch remains
subject to existing preflight, worker execution, integration, verification,
cleanup, and accepted-batch lifecycle evidence. Sequential continuation may
choose which reviewed gate to run next, but it does not become the batch
orchestrator.

The same preservation applies to `run_task`: continuation can route to the
existing task gate, but the task gate remains the authority for worktree
allocation, worker execution, evidence acceptance, merge, cleanup, and local
commit/report lifecycle.

## Stop Conditions

Stop continuation when any of these are true:

- no explicit `nextArtifactPath` or reviewed equivalent exists for a requested
  multi-step continuation;
- the next artifact is inferred from markdown prose, command strings, or the
  initiative slice table;
- `nextArtifactPath` is missing, absolute, remote, off-repo, path-traversing,
  command-like, glob-like, or environment-dependent;
- the next artifact file does not exist;
- the next artifact fails independent validation;
- artifact path or slice-id cycle detection fires;
- successor evidence is stale, missing, or does not cite the just-accepted
  predecessor evidence when the successor depends on it;
- the repo has unrelated dirty changes, stale base evidence, or unresolved
  lifecycle state;
- any artifact names active stop conditions;
- the next action requires push or has `pushAllowed: true`;
- `run_task` lacks a committed `taskSpecPath`, SDK runtime, isolated worktree
  policy, valid `HARNESS_RESULT`, scope checks, verify commands, or
  Samantha-owned accept/merge/cleanup lifecycle;
- `batch_plan` skips Phase 5.5 review, Phase 5 preparation, preflight,
  disjoint write-set proof, serial-only handling, worker run evidence,
  integration verification, lifecycle, or cleanup;
- the next step needs BK product judgment, authority movement, hidden memory,
  daemon/watch behavior, remote adapters, dashboard/routine triggers, secrets,
  connector expansion, or broad natural-language roadmap execution.

## Non-Goals

- No implementation in S8.
- No `run_task` or `batch_plan` execution in S8.
- No `nextArtifactPath` validator change in S8.
- No source changes.
- No test changes.
- No policy, contract, task-template, agent-profile, operation-artifact,
  package metadata, or lockfile changes.
- No automatic push.
- No daemon or watch service.
- No remote adapters.
- No hidden memory.
- No worker-owned orchestration.
- No broad natural-language roadmap execution.

## Follow-up Slices

S9 should be the single next ready slice: add deterministic validation and
report-only visibility for explicit `nextArtifactPath` linkage before enabling
any writer action execution. S9 should reject prose or command-string
successors, missing files, off-repo paths, cycles, stale evidence, active stop
conditions, and push requirements. It should not execute `run_task` or
`batch_plan`.

Later slices should remain behind S9 evidence:

- S10: design or implement reviewed `run_task` coordination only through
  existing run-task gates, SDK runtime, isolated worktrees, `HARNESS_RESULT`,
  scope checks, deterministic verification, and Samantha-owned lifecycle.
- S11: design or implement reviewed `batch_plan` coordination only through
  Phase 5.5 and Phase 5 gates.
- S12: dogfood the full linked-artifact report-only path before any routine
  writer action execution.

## Verification Strategy

S8 verification is documentation-only:

- confirm this artifact exists;
- grep for the required S8 section headings and non-goal language;
- run initiative readiness check against
  `references/initiatives/sequential-ceo-autopilot.md`;
- run scoped markdown diff check for the two target files.

S9 verification should be deterministic and focused:

- validator tests for accepted local `nextArtifactPath` values;
- rejection tests for prose, command strings, missing files, off-repo paths,
  path traversal, cycles, stale evidence, active stop conditions, and push
  requirements;
- report-only CLI output showing the next artifact path and blocked reasons
  without dispatching workers or batches;
- typecheck, readiness check, and scoped diff check.
