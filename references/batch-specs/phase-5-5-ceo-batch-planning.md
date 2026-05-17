# Phase 5.5 CEO Batch Planning Design

Status: implemented baseline for a Phase 5 sub-design. Phase 5.5 is not a new
roadmap phase.

This document defines how the CEO layer may turn a natural language goal into a
stored batch planning draft before existing Phase 5 `BatchSpec` assembly,
preflight, execution, integration, verification, and lifecycle gates decide
whether any writer work can run.

## Boundary

CEO batch planning starts from a natural language goal and may create a
`BatchPlanDraft`, a new untrusted planning evidence artifact. The draft is
advice and planning evidence only. It is not a `BatchSpec`, does not authorize
dispatch, and cannot mutate trusted lifecycle state.

Actual `BatchPlanDraft` evidence remains JSON under
`references/batch-plans/{draft-id}.json`. Storing the draft is mandatory even
when the plan is incomplete, blocked, or intentionally uses structured
placeholders.

The CEO layer may inspect the repo, decompose the goal, propose small writer
tasks, suggest dependencies, and recommend parallelization, but
`BatchPlanDraft` remains untrusted planning evidence. Deterministic
assembly/preflight owns `dispatchGroup`, serial-only classification, disjoint
write-set proof, target HEAD/base safety, and dispatch eligibility.

This design explicitly forbids worker-owned orchestration, `writerCap`
increases, natural-language-only dispatch, hidden memory, remote adapters,
daemon/watch behavior, dashboards, routine triggers,
policy/doctrine/contract/profile/template/package/lockfile auto-execution,
push automation, and broad CEO planning framework scope.

## Current Implemented Baseline

The Phase 5.5 baseline already includes:

- deterministic `BatchPlanDraft` schema validation;
- deterministic structured placeholder validation;
- `batch-plans:draft`, which writes validated draft evidence and returns an
  authoring report without preparing, preflighting, dispatching, or pushing;
- `batch-plans:prepare`, which reads a stored draft, writes deterministic
  TaskSpec planning artifacts, commits those planning artifacts when the repo
  state permits it, writes the execution `BatchSpec` outside the target repo
  dirty tree, and runs ordinary Phase 5 BatchSpec preflight before reporting
  the next `batches:execute` action.

This baseline still does not implement natural-language goal parsing,
natural-language-only dispatch, push automation, `writerCap` changes,
worker-owned orchestration, hidden memory, daemon/watch behavior, dashboards,
remote adapters, or changes to existing Phase 5 BatchSpec gates.

## User Flow

1. BK gives Samantha a natural language goal.
2. CEO planning classifies whether the request is eligible for routine writer
   batch planning or must route to report-only, recovery, doctrine, product
   boundary, architecture, roadmap, or blocked handling.
3. CEO planning performs lightweight repo inspection and records the summary in
   the `BatchPlanDraft`.
4. CEO planning writes the draft JSON to
   `references/batch-plans/{draft-id}.json`.
5. If the draft is eligible, Samantha promotes it into ordinary task specs and
   a Phase 5 `BatchSpec` through deterministic assembly.
6. Existing Phase 5 preflight proves scope, serial-only boundaries,
   dependencies, disjoint write sets, verification policy, and base commit
   safety.
7. Routine writer batches may be preflighted, executed, locally committed, and
   followed up autonomously only when all deterministic gates pass. Push is
   excluded from Phase 5.5 routine authority.

## BatchPlanDraft Artifact

`BatchPlanDraft` is a stored, untrusted planning evidence artifact:

```ts
type BatchPlanDraftClassification =
  | "routine_writer_batch"
  | "report_only"
  | "recovery"
  | "doctrine"
  | "product_boundary"
  | "architecture"
  | "roadmap"
  | "blocked";

interface StructuredPlaceholder {
  field: string;
  reason: string;
  resolutionOwner: "ceo" | "deterministic_assembly" | "bk";
  blocksPromotion: boolean;
}

interface BatchPlanDraft {
  schemaVersion: 1;
  draftId: string;
  createdAt: string;
  sourceGoal: string;
  classification: BatchPlanDraftClassification;
  repoInspection: RepoInspectionEvidence;
  structuredPlaceholders: StructuredPlaceholder[];
  proposedTasks: ProposedTask[];
  dependencyHints: DependencyHint[];
  parallelizationHints: ParallelizationHint[];
  autonomyEnvelope: {
    localCommitAllowed: boolean;
    pushAllowed: false;
    maxReworkCycles: 1;
  };
  promotionReadiness: {
    status: "ready" | "needs_placeholders_resolved" | "blocked";
    reasons: string[];
  };
  report: {
    summary: string;
    nextAction: string;
  };
}
```

Only `routine_writer_batch` is eligible for routine writer batch dispatch. All
non-routine classifications stop before routine writer batch dispatch:
`report_only` routes to the matching report path, `recovery` routes to the
matching recovery path, `doctrine` routes to doctrine handling,
`product_boundary` routes to product-boundary clarification, `architecture`
routes to architecture planning, `roadmap` routes to roadmap planning, and
`blocked` routes to a blocked report with the unresolved reason.

Proposed tasks must be small, independently verifiable writer surfaces. Each
task proposal should name the intended file surface, forbidden surfaces,
focused verification, and why the slice can stand alone. A broad implementation
idea is not enough to promote.

Dependency and parallelization decisions in the draft are hints. The promoted
`BatchSpec` must recompute or reject them through deterministic assembly and
preflight.

## Structured Placeholder Contract

Placeholders are allowed only through the first-class
`structuredPlaceholders` field, not free-text ambiguity. Each
`StructuredPlaceholder` must include:

- `field`: the missing draft field.
- `reason`: why the planner cannot fill it safely.
- `resolutionOwner`: `ceo`, `deterministic_assembly`, or `bk`.
- `blocksPromotion`: whether the placeholder prevents `BatchSpec` promotion.

Natural-language TODOs, implicit missing paths, guessed verification commands,
and vague dependency notes are invalid. A draft with blocking placeholders may
still be stored, but it cannot be promoted until they are resolved.

## Repo Inspection Evidence

Every draft must include lightweight repo inspection evidence. The goal is to
show what the CEO planner looked at, not to replace deterministic validation.

Required evidence:

- relevant docs or files inspected;
- current repo state summary, including whether the worktree was clean;
- candidate write surfaces considered;
- known serial-only or authority-boundary surfaces encountered;
- assumptions that influenced task slicing.

Repo inspection evidence remains untrusted. Preflight still owns actual file
existence checks, task-spec parsing, target-file matching, base commit equality,
serial-only classification, and disjoint write-set proof.

## Clean-State And BaseCommit Gate

Generated `BatchPlanDraft` and `TaskSpec` artifacts that are intended as
durable repo evidence may be locally committed by Samantha in a planning
artifact commit before execution. After that commit, executable `BatchSpec`
generation must use the planning commit `HEAD` as the BatchSpec baseCommit.

execution BatchSpec must not be committed into the target repo before dispatch.
Committing the execution `BatchSpec` into the target repo would make its own
`baseCommit` circular, because the commit hash it needs to name would not exist
until after the artifact was included. The execution `BatchSpec` should live in
a clean-target-preserving execution store outside the target repo dirty tree or
another explicitly ignored state location. Then `batches:execute` can run
against a clean target whose `HEAD` equals the BatchSpec baseCommit.

## Promotion And Execution Gates

Promotion converts a `BatchPlanDraft` into ordinary task specs and a Phase 5
`BatchSpec`; it does not dispatch work.

Promotion must stop when:

- the draft is not classified as `routine_writer_batch`;
- the draft is classified as `report_only`, `recovery`, `doctrine`,
  `product_boundary`, `architecture`, `roadmap`, or `blocked`, in which case it
  routes to the matching report, plan, doctrine, architecture, roadmap, or
  recovery path before any routine writer batch dispatch;
- any blocking structured placeholder remains;
- proposed tasks are not small independently verifiable writer surfaces;
- the plan targets policy, doctrine, contracts, agent profiles, task templates,
  package metadata, or lockfiles for auto-execution;
- dependency or parallelization hints cannot be converted into deterministic
  task specs and `BatchSpec` structure.

Execution remains the existing Phase 5 path:

```text
BatchPlanDraft
-> deterministic promotion into task specs and BatchSpec
-> planning artifact commit for durable draft and task specs
-> execution BatchSpec stored outside the target repo dirty tree
-> BatchSpec preflight
-> isolated worker runs
-> independent run logs and candidate commits
-> ordered Samantha-owned integration
-> focused verification after each accepted candidate
-> final batch verification
-> local Samantha-owned commit when gates pass
```

Workers must not spawn, coordinate, reorder, rebase, merge, clean up, mutate
batch state, or make lifecycle decisions.

## Autonomy Envelope

CEO authority is broad for planning and local routine follow-through, but
trusted state changes remain behind deterministic harness gates.

The `autonomyEnvelope` for Phase 5.5 is:

```yaml
autonomyEnvelope:
  canDraftFromNaturalLanguageGoal: true
  canStoreBatchPlanDraft: true
  canPromoteRoutineWriterBatch: true
  canPreflightRoutineWriterBatch: true
  canExecuteRoutineWriterBatch: true
  canLocallyCommitAcceptedRoutineBatch: true
  canRecommendFollowUp: true
  pushAllowed: false
  maxReworkCycles: 1
```

Routine writer batches may be promoted, preflighted, executed, locally
committed, and followed up autonomously when gates pass. Push automation is not
part of Phase 5.5 and remains excluded with `pushAllowed: false`.

Successful continuation is a success follow-up: post-pass continuation from
completed evidence after the ordinary Phase 5 gates pass. A success follow-up
is not counted against `maxReworkCycles: 1`; if it becomes new writer work, it
must start from a new planning and deterministic gate cycle.

Failure handling is failed-evidence rework: one narrow rework cycle from failed
preflight, execution, integration, or verification evidence. `maxReworkCycles:
1` applies only to failed-evidence rework, not normal successful continuation.
After that one failed-evidence rework cycle, Samantha must report the stop
condition and next action instead of looping.

## Report Contract

Every Phase 5.5 report must include:

- source natural language goal;
- draft id and path under `references/batch-plans/{draft-id}.json`;
- classification and promotion status;
- repo inspection summary;
- proposed task count and any blocked placeholders;
- preflight, execution, verification, and local commit outcomes when run;
- planning artifact commit outcome when durable planning evidence was committed;
- whether any post-pass continuation was a success follow-up or any failed
  continuation was failed-evidence rework;
- explicit statement that push was not performed;
- next action.

Reports must not imply trusted completion from draft text alone. Trusted
completion requires the ordinary Phase 5 evidence chain.

Report ownership is split by lifecycle surface:

- `batch-plans:draft` owns the draft authoring report. It reports the
  `sourceGoal`, draft id/path, classification, promotion readiness, repo
  inspection summary, proposed task count, blocked placeholder count,
  `prepareOutcome: "not_run"`, `preflightOutcome: "not_run"`,
  `pushPerformed: false`, violations, and next action.
- `batch-plans:prepare` owns the preparation report. It reports the
  `sourceGoal`, draft id/path, batch id when known, repo inspection summary,
  proposed task count, TaskSpec writes, planning commit result, base commit
  gate, execution BatchSpec storage result, BatchSpec preflight result,
  prepare/preflight outcomes, `pushPerformed: false`, violations, and next
  action.
- `batches:execute` remains the Phase 5 execution owner. It owns worker run,
  candidate commit, integration, verification, stale-base, cleanup, and local
  accepted-batch lifecycle evidence. Phase 5.5 reports may point to
  `batches:execute` as the next action, but they do not claim execution,
  integration, verification, cleanup, trusted completion, or push completion.

## Non-Goals

Phase 5.5 does not implement or authorize:

- worker-owned orchestration;
- natural-language-only dispatch;
- `writerCap` increases;
- push automation;
- policy, doctrine, contract, profile, template, package, or lockfile
  auto-execution;
- hidden memory;
- remote adapters;
- daemon or watch behavior;
- dashboards;
- routine triggers;
- Telegram, remote adapters, multi-project orchestration, CEO-office memory,
  routines, or budget governance;
- a broad CEO planning framework beyond stored batch planning drafts.

## Future Candidates

- Report-only review for repeated planner quality issues.
- A reviewed push authority design after Phase 5.5, if local routine authority
  proves stable.

## Open Questions

- Should `BatchPlanDraft` ids be user-facing, timestamp-based, or derived from
  the source goal plus repo state?
- Which repo inspection fields should become required deterministic validation
  inputs versus retained as planning evidence only?
- Should blocked drafts have a separate lifecycle status, or is
  `promotionReadiness.status` enough for the MVP?
