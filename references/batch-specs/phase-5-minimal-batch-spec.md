# Phase 5 Minimal BatchSpec Draft

Status: contract and preflight reference; execution and mutation closure are
tracked in `phase-5-writer-batch-execution-design.md`.

This document narrows the minimum artifact Samantha needs before speculative
writer batches can be implemented. It does not authorize writer parallelism,
does not raise `writerCap`, and does not itself define merge or cleanup
execution.

## Boundary

A `BatchSpec` is a Samantha-owned planning artifact for multiple writer task
specs that may eventually run as isolated candidate commits. It exists to prove
dependency, write-set, integration, stale-base, partial-failure, and cleanup
decisions before dispatch.

The artifact is not trusted worker output. Workers must not create, mutate, or
interpret `BatchSpec` authority. Samantha owns preflight, dispatch order,
integration order, verification, lifecycle recording, and cleanup decisions.

Stop before implementation when any required rule below needs an authority
boundary change, a broad framework, actual writer batch execution, or treating
report output as trusted state.

## Draft Shape

```ts
type BatchStatus =
  | "planned"
  | "preflight_passed"
  | "dispatched"
  | "partially_failed"
  | "integrated"
  | "rejected"
  | "cleaned";

type BatchTaskStatus =
  | "planned"
  | "eligible"
  | "dispatched"
  | "passed"
  | "failed"
  | "blocked"
  | "accepted"
  | "rejected"
  | "cleaned";

type WriteSetClassification = "parallel_eligible" | "serial_only";

interface BatchSpec {
  schemaVersion: 1;
  batchId: string;
  repoRoot: string;
  baseCommit: string;
  status: BatchStatus;
  tasks: BatchTaskSpec[];
  dependencies: BatchDependency[];
  serialOnlyRules: SerialOnlyRule[];
  integrationQueue: IntegrationQueueItem[];
  verification: BatchVerificationPolicy;
  lifecyclePolicy: BatchLifecyclePolicy;
}

interface BatchTaskSpec {
  taskId: string;
  taskSpecPath: string;
  targetAgent: string;
  declaredTargetFiles: string[];
  declaredForbiddenChanges: string[];
  expectedVerifyCommands: string[];
  writeSetClassification: WriteSetClassification;
  classificationReasons: string[];
  dispatchGroup: string;
  status: BatchTaskStatus;
  runLogPath?: string;
  candidateCommit?: string;
}

interface BatchDependency {
  before: string;
  after: string;
  reason: string;
}

interface SerialOnlyRule {
  id: string;
  glob: string;
  reason: string;
}

interface IntegrationQueueItem {
  order: number;
  taskId: string;
  requiresAccepted: string[];
  expectedCandidateCommit?: string;
  focusedVerifyCommands: string[];
  status: "pending" | "accepted" | "skipped" | "failed";
}

interface BatchVerificationPolicy {
  preflightChecks: string[];
  afterEachAcceptedMerge: string[];
  afterFinalAcceptedMerge: string[];
}

interface BatchLifecyclePolicy {
  staleBase: "block_and_replan";
  rebase: "explicit_samantha_owned_rebase_only";
  partialFailure: "block_dependents_allow_independent_candidates";
  cleanup: "explicit_per_worker_lifecycle_after_resolution";
}
```

## Required Serial-Only Rules

The first implementation should treat these path classes as serial-only:

```json
[
  {
    "id": "contracts",
    "glob": "src/core/contracts.ts",
    "reason": "contract changes can grant or restrict authority"
  },
  {
    "id": "policy",
    "glob": "src/core/policy.ts",
    "reason": "policy changes control dispatch authority"
  },
  {
    "id": "package-metadata",
    "glob": "package.json",
    "reason": "package metadata changes affect all tasks"
  },
  {
    "id": "lockfile",
    "glob": "bun.lock",
    "reason": "lockfile changes are shared integration state"
  },
  {
    "id": "task-templates",
    "glob": "references/task-templates/**",
    "reason": "templates define future worker authority"
  },
  {
    "id": "agent-profiles",
    "glob": "references/agent-profiles/**",
    "reason": "agent profiles define worker authority"
  },
  {
    "id": "doctrine-agents",
    "glob": "AGENTS.md",
    "reason": "repository instructions define authority boundaries"
  },
  {
    "id": "doctrine-north-star",
    "glob": "NORTH_STAR.md",
    "reason": "product identity defines authority boundaries"
  },
  {
    "id": "doctrine-architecture",
    "glob": "ARCHITECTURE.md",
    "reason": "architecture defines authority boundaries"
  },
  {
    "id": "doctrine-learning",
    "glob": "LEARNING_ARCHITECTURE.md",
    "reason": "learning rules define durable memory boundaries"
  },
  {
    "id": "doctrine-roadmap",
    "glob": "ROADMAP.md",
    "reason": "roadmap changes phase authority"
  },
  {
    "id": "doctrine-work-rules",
    "glob": "WORK-RULES.md",
    "reason": "work rules define execution discipline"
  }
]
```

Any task that targets one of these classes must be classified as
`serial_only`. A serial-only task may exist in a batch artifact, but it cannot
share a `dispatchGroup` with any other task. If a serial-only task changes an
authority boundary, the batch must stop and become a separate policy or
doctrine task with focused tests or report-only review as required by
`AGENTS.md` and `ARCHITECTURE.md`.

## Validation Rules

Phase 5 closes only artifact-local planning structure validation. It does not
parse referenced `TaskSpec` files, inspect git state, create worktrees, prove
glob disjointness, dispatch workers, merge candidates, trust worker reports, or
perform cleanup.

| Area | Phase 5 planning validator coverage | Deferred boundary |
| --- | --- | --- |
| Batch identity and base | `schemaVersion`, `batchId` shape, `baseCommit` hash shape, and batch `status` enum. | Batch artifact store uniqueness, commit resolution in `repoRoot`, target `HEAD` equality, worker worktree base creation, and stale-base detection require preflight or execution state. |
| Task references | Unique `taskId`; task `status` enum; required non-empty `taskSpecPath`, `targetAgent`, `declaredTargetFiles`, `declaredForbiddenChanges`, `expectedVerifyCommands`, and `dispatchGroup`; `writeSetClassification` enum; non-empty `classificationReasons` for `serial_only`; no `runLogPath` or `candidateCommit` before dispatch. | `TaskSpec` file existence/parsing, writer profile/behavior checks, and matching declared fields against the referenced `TaskSpec` require the preflight framework. |
| Dependency DAG | Existing dependency endpoints, self-dependency rejection, cycle rejection, integration queue topological ordering, and direct dependencies represented in `requiresAccepted`. | Runtime dispatch gating and failure-to-blocked transitions require dispatch lifecycle state. |
| Disjoint write-set preflight | Empty `declaredTargetFiles` is rejected as an invalid planning reference shape. | Repo-relative path normalization, absolute/`..` rejection, overlap checks, forbidden-change matching, deterministic glob analysis, and same-`dispatchGroup` disjoint proof require preflight path analysis. |
| Serial-only classification | `writeSetClassification` is limited to `parallel_eligible` or `serial_only`; `serial_only` requires at least one classification reason. | Matching target files against `serialOnlyRules`, proving `parallel_eligible` has no serial-only targets, and enforcing that serial-only tasks are sole `dispatchGroup` members require serial-only rule and path-analysis preflight. |
| Integration queue | Every task appears exactly once; `order` starts at `1` and is contiguous; queue task ids exist; queue `status` enum is valid; `requiresAccepted` entries exist, are not self-references, point to earlier queue items, and include direct dependencies; `focusedVerifyCommands` includes each task's `expectedVerifyCommands`; `expectedCandidateCommit` is absent before dispatch. | Matching `expectedCandidateCommit` to run evidence, proving workers cannot mutate merge order, and rerunning focused/final verification are integration execution responsibilities. |
| Stale base, rebase, partial failure, cleanup | `verification.preflightChecks`, `verification.afterEachAcceptedMerge`, and `verification.afterFinalAcceptedMerge` must be non-empty string arrays; `lifecyclePolicy` must declare the Phase 5 literal policies for stale base, rebase, partial failure, and cleanup. | Executing rebase, accepting partial candidates, mutating lifecycle state, and performing cleanup require git state, worker evidence, integration decisions, and lifecycle execution records. |

### Batch Identity And Base

- `schemaVersion` must be exactly `1`.
- `batchId` must be unique in the batch artifact store and match
  `^[a-z0-9][a-z0-9-]{2,79}$`.
- `baseCommit` must be a full 40-character commit hash that resolves in
  `repoRoot`.
- Preflight must record the target repo `HEAD` and it must equal `baseCommit`.
- Every writer worktree planned by the batch must be created from exactly
  `baseCommit`.
- If target repo `HEAD` changes before integration, the batch is stale and must
  stop under `lifecyclePolicy.staleBase`.

### Task References

- `tasks[].taskId` must be unique.
- Each `taskSpecPath` must exist and parse as a normal `TaskSpec`.
- Each task must target a writer profile, use writer behavior, declare
  `targetFiles`, declare `forbiddenChanges`, and declare `verifyCommands`.
- `declaredTargetFiles`, `declaredForbiddenChanges`, and
  `expectedVerifyCommands` must match the referenced task spec at preflight.
- `runLogPath` and `candidateCommit` are absent before dispatch. They can only
  be filled from Samantha-owned run evidence after a worker run passes ordinary
  writer gates.

### Dependency DAG

- Every dependency endpoint must reference a task in `tasks`.
- Self-dependencies are invalid.
- The dependency graph must be acyclic.
- `integrationQueue` must be a topological ordering of the dependency graph.
- A task cannot dispatch before every direct dependency is either accepted or
  intentionally represented as an already-integrated prerequisite outside the
  batch.
- If a task fails, every transitive dependent task becomes `blocked` unless the
  batch is explicitly replanned into a new `BatchSpec`.

### Disjoint Write-Set Preflight

- All paths are normalized as repo-relative POSIX paths before comparison.
- Absolute paths, `..`, empty strings, and paths outside `repoRoot` are invalid.
- Exact target-file overlap between two parallel-eligible tasks is invalid.
- Literal parent-child overlap is invalid. For example, `src/core` and
  `src/core/policy.ts` cannot be parallel-eligible in the same dispatch group.
- A target path that matches another task's `forbiddenChanges` is invalid.
- A generated or wildcard target that cannot be proven disjoint by deterministic
  glob analysis must be classified as `serial_only`.
- A task with an empty or implicit write set is invalid for writer batching,
  even if ordinary single-writer dispatch would later reject it too.
- Preflight must fail before dispatch if two tasks in the same `dispatchGroup`
  are not proven disjoint.

### Serial-Only Classification

- A task is `serial_only` when any declared target file matches
  `serialOnlyRules`.
- A task is also `serial_only` when its target files include package metadata,
  lockfiles, contracts, policy, task templates, agent profiles, doctrine docs,
  or any path that changes authority boundaries.
- A `serial_only` task must have a non-empty `classificationReasons` list.
- A `parallel_eligible` task must have no serial-only target matches and must
  pass disjoint write-set preflight against every task in its dispatch group.
- A serial-only task must be the only member of its `dispatchGroup`.

### Ordered Samantha-Owned Integration Queue

- Every task appears exactly once in `integrationQueue`.
- `order` values must start at `1` and be contiguous.
- `requiresAccepted` must include all direct dependencies and may include
  additional Samantha-owned ordering gates.
- `focusedVerifyCommands` must include the task's `expectedVerifyCommands`.
- `expectedCandidateCommit` is absent before dispatch and must match the
  candidate commit recorded in the task's run log before integration.
- Workers do not choose merge order. A worker report, note, or
  `HARNESS_RESULT` cannot mutate `integrationQueue`.
- After each accepted integration item, Samantha must rerun that item's focused
  verification outside the worker worktree.
- After the last accepted integration item, Samantha must run
  `verification.afterFinalAcceptedMerge`.

### Stale Base, Rebase, Partial Failure, And Cleanup

- `staleBase` is `block_and_replan`: if target repo `HEAD` differs from
  `baseCommit` before integration, no queued item can be accepted until
  Samantha creates a new explicit plan. Execution records terminal
  `block_and_replan` evidence instead of automatically generating the
  replacement `BatchSpec`.
- Replacement `BatchSpec` generation is explicit-only through the
  Samantha-owned `batches:replace` command/API. It reads matching
  `batch-replan-evidence.jsonl` terminal evidence, writes a new BatchSpec with a
  new `batchId`, `baseCommit` set to the evidence `observedHead`, and
  `status: planned`, resets task statuses to `planned`, resets
  `integrationQueue` statuses to `pending`, and removes `runLogPath`,
  `candidateCommit`, and `expectedCandidateCommit` so pre-dispatch evidence
  absence validation still applies. The replacement is still only a plan; it
  must pass ordinary BatchSpec preflight before any dispatch.
- `rebase` is `explicit_samantha_owned_rebase_only`: workers do not rebase
  batch branches. A rebase creates new evidence and requires the same scope and
  verification checks before the candidate can be accepted. Samantha-owned
  rebase execution remains deferred until a reviewed rebase plan/evidence
  contract exists.
- `partialFailure` is `block_dependents_allow_independent_candidates`: a failed
  task blocks dependents, but independent passed candidates can remain eligible
  if their dependencies and write-set guarantees still hold.
- Failed worker output remains evidence only. It cannot be merged, used as a
  trusted base, or used to update the batch artifact except through
  Samantha-owned failure status.
- Source `BatchSpec` lifecycle/status mutation is limited to explicit
  Samantha-owned rejection through `batches:reject`. That command records
  before/after audit evidence in `batch-lifecycle-audit.jsonl`, mutates only the
  top-level `status` to `rejected`, and does not update task statuses,
  candidate evidence, or `integrationQueue`. Worker output cannot change batch
  status, `integrationQueue`, or lifecycle state.
- `batches:replace` does not mutate the source `BatchSpec`; source closure
  remains a separate `batches:reject` decision. Replacement generation records
  audit evidence in `batch-replacement-audit.jsonl` with the source batch id,
  source `baseCommit`, observed `HEAD`, replan evidence path, replacement path,
  and `sourceBatchSpecMutation: "not_performed"`.
- `cleanup` is `explicit_per_worker_lifecycle_after_resolution`: cleanup is
  allowed only after each worker has a recorded terminal decision such as
  accepted, rejected, superseded, or abandoned.
- Cleanup must not remove a dirty, missing, unintegrated, or unresolved worker
  worktree. Cleanup must record lifecycle evidence per worker.

## Minimal Example

```json
{
  "schemaVersion": 1,
  "batchId": "phase-5-fixture-batch",
  "repoRoot": "/Users/byung/Documents/samantha",
  "baseCommit": "0123456789abcdef0123456789abcdef01234567",
  "status": "planned",
  "tasks": [
    {
      "taskId": "add-run-list-test",
      "taskSpecPath": "references/tasks/add-run-list-test.json",
      "targetAgent": "codex-worker",
      "declaredTargetFiles": ["tests/run-list.test.ts"],
      "declaredForbiddenChanges": ["src/core/policy.ts", "references/agent-profiles/**"],
      "expectedVerifyCommands": ["bun test tests/run-list.test.ts"],
      "writeSetClassification": "parallel_eligible",
      "classificationReasons": [],
      "dispatchGroup": "group-1",
      "status": "planned"
    },
    {
      "taskId": "add-run-show-test",
      "taskSpecPath": "references/tasks/add-run-show-test.json",
      "targetAgent": "codex-worker",
      "declaredTargetFiles": ["tests/run-show.test.ts"],
      "declaredForbiddenChanges": ["src/core/policy.ts", "references/agent-profiles/**"],
      "expectedVerifyCommands": ["bun test tests/run-show.test.ts"],
      "writeSetClassification": "parallel_eligible",
      "classificationReasons": [],
      "dispatchGroup": "group-1",
      "status": "planned"
    }
  ],
  "dependencies": [],
  "serialOnlyRules": [
    {
      "id": "contracts",
      "glob": "src/core/contracts.ts",
      "reason": "contract changes can grant or restrict authority"
    },
    {
      "id": "policy",
      "glob": "src/core/policy.ts",
      "reason": "policy changes control dispatch authority"
    },
    {
      "id": "package-metadata",
      "glob": "package.json",
      "reason": "package metadata changes affect all tasks"
    },
    {
      "id": "lockfile",
      "glob": "bun.lock",
      "reason": "lockfile changes are shared integration state"
    },
    {
      "id": "task-templates",
      "glob": "references/task-templates/**",
      "reason": "templates define future worker authority"
    },
    {
      "id": "agent-profiles",
      "glob": "references/agent-profiles/**",
      "reason": "agent profiles define worker authority"
    },
    {
      "id": "doctrine-agents",
      "glob": "AGENTS.md",
      "reason": "repository instructions define authority boundaries"
    },
    {
      "id": "doctrine-north-star",
      "glob": "NORTH_STAR.md",
      "reason": "product identity defines authority boundaries"
    },
    {
      "id": "doctrine-architecture",
      "glob": "ARCHITECTURE.md",
      "reason": "architecture defines authority boundaries"
    },
    {
      "id": "doctrine-learning",
      "glob": "LEARNING_ARCHITECTURE.md",
      "reason": "learning rules define durable memory boundaries"
    },
    {
      "id": "doctrine-roadmap",
      "glob": "ROADMAP.md",
      "reason": "roadmap changes phase authority"
    },
    {
      "id": "doctrine-work-rules",
      "glob": "WORK-RULES.md",
      "reason": "work rules define execution discipline"
    }
  ],
  "integrationQueue": [
    {
      "order": 1,
      "taskId": "add-run-list-test",
      "requiresAccepted": [],
      "focusedVerifyCommands": ["bun test tests/run-list.test.ts"],
      "status": "pending"
    },
    {
      "order": 2,
      "taskId": "add-run-show-test",
      "requiresAccepted": [],
      "focusedVerifyCommands": ["bun test tests/run-show.test.ts"],
      "status": "pending"
    }
  ],
  "verification": {
    "preflightChecks": [
      "validate batch identity and baseCommit",
      "validate task references against TaskSpec",
      "validate dependency DAG",
      "validate disjoint write sets",
      "validate serial-only classifications",
      "validate integration queue"
    ],
    "afterEachAcceptedMerge": ["run focused verify commands for the accepted queue item"],
    "afterFinalAcceptedMerge": ["bun run typecheck", "bun test"]
  },
  "lifecyclePolicy": {
    "staleBase": "block_and_replan",
    "rebase": "explicit_samantha_owned_rebase_only",
    "partialFailure": "block_dependents_allow_independent_candidates",
    "cleanup": "explicit_per_worker_lifecycle_after_resolution"
  }
}
```
