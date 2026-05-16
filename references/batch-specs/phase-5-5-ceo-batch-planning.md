# Phase 5.5 CEO Batch Planning Design

Status: design artifact for a Phase 5 sub-design. Phase 5.5 is not a new
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

Actual drafts are always stored as JSON under
`references/batch-plans/{draft-id}.json`. Storing the draft is mandatory even
when the plan is incomplete, blocked, or intentionally uses structured
placeholders.

The CEO layer may inspect the repo, decompose the goal, propose small writer
tasks, suggest dependencies, and recommend parallelization. Deterministic
assembly and preflight own `dispatchGroup`, serial-only classification,
disjoint write-set proof, target `HEAD` safety, and dispatch eligibility.

This design explicitly forbids worker-owned orchestration,
natural-language-only dispatch, `writerCap` increases, push automation,
policy/doctrine/contract/profile/template/package/lockfile auto-execution,
hidden memory, remote adapters, daemon/watch behavior, dashboards, routine
triggers, and broad CEO planning framework scope.

## User Flow

1. BK gives Samantha a natural language goal.
2. CEO planning classifies whether the request is eligible for routine writer
   batch planning or must stay in doctrine, product boundary, architecture,
   roadmap, report-only review, or recovery mode.
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
interface BatchPlanDraft {
  schemaVersion: 1;
  draftId: string;
  createdAt: string;
  sourceGoal: string;
  classification: "routine_writer_batch" | "blocked" | "report_only" | "doctrine_or_policy";
  repoInspection: RepoInspectionEvidence;
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

Proposed tasks must be small, independently verifiable writer surfaces. Each
task proposal should name the intended file surface, forbidden surfaces,
focused verification, and why the slice can stand alone. A broad implementation
idea is not enough to promote.

Dependency and parallelization decisions in the draft are hints. The promoted
`BatchSpec` must recompute or reject them through deterministic assembly and
preflight.

## Structured Placeholder Contract

Placeholders are allowed only when they are structured fields, not free-text
ambiguity. A placeholder must include:

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

## Promotion And Execution Gates

Promotion converts a `BatchPlanDraft` into ordinary task specs and a Phase 5
`BatchSpec`; it does not dispatch work.

Promotion must stop when:

- the draft is not classified as `routine_writer_batch`;
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
part of Phase 5.5. Rework is limited to one cycle; after `maxReworkCycles: 1`,
Samantha must report the stop condition and next action instead of looping.

## Report Contract

Every Phase 5.5 report must include:

- source natural language goal;
- draft id and path under `references/batch-plans/{draft-id}.json`;
- classification and promotion status;
- repo inspection summary;
- proposed task count and any blocked placeholders;
- preflight, execution, verification, and local commit outcomes when run;
- explicit statement that push was not performed;
- next action.

Reports must not imply trusted completion from draft text alone. Trusted
completion requires the ordinary Phase 5 evidence chain.

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

- Deterministic draft schema validation and placeholder validation.
- A promotion command that writes task specs and `BatchSpec` artifacts only
  after validating the draft.
- Report-only review for repeated planner quality issues.
- A reviewed push authority design after Phase 5.5, if local routine authority
  proves stable.

## Open Questions

- Should `BatchPlanDraft` ids be user-facing, timestamp-based, or derived from
  the source goal plus repo state?
- What exact command should own promotion from draft JSON to task specs and a
  `BatchSpec`?
- Which repo inspection fields should become required deterministic validation
  inputs versus retained as planning evidence only?
- Should blocked drafts have a separate lifecycle status, or is
  `promotionReadiness.status` enough for the MVP?
