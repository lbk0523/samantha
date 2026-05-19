# Sequential CEO Autopilot Design Contract

Last updated: 2026-05-19

## Purpose

Sequential CEO Autopilot lets Samantha continue through the next safe slice of
an approved initiative after ordinary gates pass, without making BK schedule
each successful follow-up manually.

This contract is not an implementation plan for new worker authority. It defines
the artifact lifecycle, continuation artifact responsibilities, conservative
action vocabulary, autonomy envelope, stop conditions, and evidence expectations
that later deterministic code must preserve.

## Product Boundary

Sequential CEO Autopilot may select the next ready slice from an approved
initiative only when the slice has explicit structured continuation state and
the existing Samantha gates can verify the action.

It must not add or imply:

- Telegram, remote adapters, daemon/watch behavior, dashboards, routine
  triggers, CEO-office memory, budget governance, or multi-project
  orchestration;
- worker-owned orchestration, worker dispatch outside task specs, or
  natural-language-only dispatch;
- automatic push, hidden memory, lifecycle mutation from worker text, or
  policy/doctrine/template/profile/package/lockfile auto-execution.

## Artifact Lifecycle

Sequential continuation uses reviewable local artifacts only:

```text
approved initiative
-> Initiative Continuity Brief
-> structured continuation artifact
-> next ready slice selection
-> existing Samantha action gate
-> run, report, readiness, or batch evidence
-> deterministic status update
-> next ready slice or stop report
```

The Initiative Continuity Brief remains the durable parent context under
`references/initiatives/<slug>.md`. It stores the goal, accepted decisions,
non-goals, invariants, slice queue, current next slice, and handoff prompt.

The structured continuation artifact is the trusted routing input for
sequential continuation. It must be stored as a reviewable local artifact, be
schema-validated before use, and cite the Initiative Continuity Brief it
belongs to. It may summarize the next action, but it must not replace task
specs, Phase 5.5 `BatchPlanDraft` evidence, Phase 5 `BatchSpec` evidence, run
logs, verification output, lifecycle records, or Samantha-owned commits.

Status may move forward only from cited local evidence. Worker prose, markdown
roadmap text, or a report-only recommendation cannot by itself mark a slice
completed, authorize dispatch, update lifecycle state, or spend a rework cycle.

## Structured Continuation Artifact Responsibilities

The structured continuation artifact is responsible for deterministic routing
state:

- `schemaVersion`, artifact id, initiative path, created/updated timestamps, and
  current slice id;
- explicit slice status using the Initiative Continuity Brief status
  vocabulary;
- one allowed action type for the current slice;
- dependency and prerequisite status;
- target files, forbidden files, and verify commands when the action can write;
- autonomy envelope values, including `pushAllowed: false` and
  `maxFailedEvidenceReworkCycles`;
- stop condition checklist and whether any condition is active;
- evidence references used for the last status transition;
- exact next Samantha command or blocked-report message.

The artifact must reject ambiguity rather than encode it in prose. Missing
paths, guessed verification commands, unsafe authority surfaces, unknown action
types, or unresolved product decisions are stop conditions.

## Conservative Action Type Vocabulary

Initial action types are deliberately narrow:

- `manual_decision`: stop and ask BK for a named decision.
- `report_only`: run or summarize report-only evidence without writes.
- `readiness_check`: run deterministic readiness checks and report results.
- `run_task`: run an explicit task spec through existing `run-task` gates.
- `batch_plan`: draft, prepare, review, or execute an explicit routine writer
  batch only through existing Phase 5.5 and Phase 5 gates.

No other action type is valid for the MVP. Broader actions require a later
reviewed design and deterministic validation before routine use.

## Autonomy Envelope

The initial autonomy envelope is:

```yaml
canSelectNextReadySlice: true
canRunReadinessChecks: true
canRunReportOnlyActions: true
canRunExplicitTaskSpecs: true
canRunRoutineBatchActions: true
canUpdateContinuationStatus: true
canLocallyCommitThroughExistingGates: true
pushAllowed: false
maxFailedEvidenceReworkCycles: 1
```

Successful continuation is not rework. When a slice passes its ordinary gates,
Samantha may select the next ready slice within this envelope.

Failed-evidence rework is different. A failed preflight, worker run,
integration, verification, readiness, or report evidence path may get at most
one narrow rework cycle. After `maxFailedEvidenceReworkCycles` is spent,
Samantha must stop and report the failure instead of looping.

## Stop Conditions

Sequential CEO Autopilot must stop before continuing when any stop condition is
active:

- the next slice needs a BK product, scope, priority, or authority decision;
- the next slice targets doctrine, policy, contracts, agent profiles, task
  templates, package metadata, lockfiles, or authority boundaries without a
  specific reviewed plan;
- target files, forbidden files, verify commands, repo root, or base evidence
  are missing or ambiguous;
- the repo has unrelated dirty changes, stale base evidence, or unresolved
  lifecycle state;
- the structured continuation artifact fails validation or names an unknown
  action type;
- a required worker run lacks a valid `HARNESS_RESULT`;
- scope checks fail or changed files exceed the declared target surface;
- deterministic verification fails and the allowed rework cycle is already
  spent;
- the next step requires push, secrets, new connectors, remote adapters,
  daemon/watch behavior, hidden memory, dashboards, routine triggers, or
  multi-project orchestration;
- the runner cannot update local evidence without inventing facts.

The stop report must name the active stop condition, cite the evidence, and give
the exact next safe Samantha command or BK decision needed.

## Report And Evidence Expectations

Every continuation report must include:

- initiative path and structured continuation artifact path;
- current slice id, action type, and status transition;
- evidence references used for that transition;
- verify commands run and their pass/fail status;
- whether the step was successful continuation or failed-evidence rework;
- remaining failed-evidence rework budget;
- explicit `pushPerformed: false`;
- next ready slice or active stop condition;
- exact next Samantha command or blocked handoff.

Reports must not claim trusted completion from markdown text, worker summaries,
or report-only advice. Trusted completion requires Samantha-owned scope checks,
deterministic verification, run evidence when applicable, lifecycle records, and
local commit/report gates already required by the existing harness.

## Boundary Preservation

Sequential CEO Autopilot preserves the Initiative Continuity Brief boundary by
using the brief as durable parent context only. The brief explains why the work
exists and what slice is next; it does not authorize execution, dispatch, merge,
cleanup, push, or lifecycle mutation.

It preserves the Phase 5.5 `BatchPlanDraft` boundary by treating batch planning
as one allowed action type, not as a replacement for Phase 5.5. A
`BatchPlanDraft` remains untrusted planning evidence under
`references/batch-plans/{draft-id}.json`; deterministic preparation and Phase 5
preflight still own promotion, dispatch eligibility, disjoint write-set proof,
serial-only handling, worker execution, integration, verification, cleanup
evidence, and local accepted-batch lifecycle state.

Sequential continuation coordinates the order of safe next actions. It does not
weaken any existing Samantha gate.
