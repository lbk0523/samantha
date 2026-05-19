# Initiative: Sequential CEO Autopilot

Status: planned
Source: Samantha brainstorm and plan on 2026-05-19 about reducing BK's
midstream scheduler burden while preserving Samantha's execution gates.
Last updated: 2026-05-19

## Goal

Let BK approve a coherent roadmap or initiative once, then let Samantha continue
through the next safe slices until an explicit stop condition is reached.

The useful outcome is not a looser worker. The useful outcome is a stronger CEO
loop:

```text
approved initiative
-> structured continuation plan
-> next ready slice
-> existing Samantha gates
-> evidence-backed status update
-> next ready slice or stop report
```

BK should stop acting as the manual scheduler between every `sam p:` and
`sam c:` turn. Samantha should still stop for product decisions, authority
changes, failed verification beyond the allowed rework envelope, dirty repo
risk, push, or unclear scope.

## Source

- BK's approved direction in the 2026-05-19 Samantha brainstorm:
  avoid adding Hermes as an external orchestration layer and instead improve
  Samantha's CEO layer.
- `references/batch-specs/phase-5-5-ceo-batch-planning.md`, especially the
  existing autonomy envelope and successful continuation language.
- `references/playbooks/initiative-continuity-brief.md`, which defines the
  durable parent context for multi-slice work.
- `WORK-RULES.md` intent handoff and next-action-level gates.
- Existing Phase 5 batch gates in `ROADMAP.md` and `ARCHITECTURE.md`.

## Accepted Decisions

- Samantha should absorb the useful Hermes-shaped capabilities internally:
  intake, context packing, prioritization, task drafting, and continuation.
- The first product target is sequential continuation, not a chat adapter,
  daemon, dashboard, remote control plane, or external agent wrapper.
- A roadmap must not become one large worker task. It must become a queue of
  independently verifiable slices.
- Natural-language markdown may preserve initiative context, but trusted
  continuation must come from a structured, validated artifact or existing
  deterministic Samantha commands.
- Successful continuation may proceed to the next ready slice after ordinary
  gates pass. Failed-evidence rework is limited to one narrow cycle before
  Samantha stops and reports.
- Push remains out of scope. Local commits may happen only through existing
  Samantha-owned gates.

## Non-Goals

- No Hermes integration.
- No worker-owned orchestration.
- No natural-language-only dispatch.
- No hidden memory.
- No daemon, watch service, routine trigger, dashboard, or remote adapter.
- No automatic push.
- No automatic policy, doctrine, contract, agent profile, task template,
  package metadata, or lockfile execution.
- No bypass of task specs, isolated worktrees, scope checks, deterministic
  verification, `HARNESS_RESULT`, run logs, merge checks, cleanup evidence, or
  Samantha-owned lifecycle records.

## Invariants

- Samantha owns orchestration, worktree allocation, verification, integration,
  local commit/report, lifecycle evidence, and cleanup.
- Workers may only perform the bounded work declared by task specs, agent
  profiles, target files, forbidden changes, and verify commands.
- Report-only evidence remains advice-only and cannot mutate trusted state.
- A continuation runner may consume successful evidence, but it must not treat
  worker text or a markdown roadmap as trusted completion.
- Every state transition must leave reviewable local evidence.
- Any authority-moving change must be designed and reviewed before routine use.

## Planned Capability Shape

Sequential CEO Autopilot should introduce two separate surfaces:

1. A human-readable Initiative Continuity Brief, already defined by the current
   playbook, for preserving context and decisions.
2. A structured continuation artifact, introduced in this initiative, for
   deterministic status, action type, allowed autonomy, and stop-condition
   handling.

The structured artifact should be narrow. It should name explicit slices,
allowed action types, dependencies, verification expectations, and the
autonomy envelope. It should not ask Samantha to infer executable work from raw
ROADMAP prose.

Initial action types should be conservative:

- `manual_decision`: stop and ask BK.
- `report_only`: run or summarize report-only evidence without writes.
- `run_task`: run an explicit task spec through existing `run-task` gates.
- `batch_plan`: draft, review, prepare, or execute an explicit routine writer
  batch only through existing Phase 5.5 and Phase 5 gates.
- `readiness_check`: run deterministic readiness checks.

Any broader action type should require a later reviewed design.

## Autonomy Envelope

The initial envelope should be:

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

Successful continuation does not count against
`maxFailedEvidenceReworkCycles`. Failed-evidence rework does.

## Stop Conditions

Stop before continuing when any of these appear:

- the next slice needs a BK product or authority decision;
- the next slice targets doctrine, policy, contracts, agent profiles, task
  templates, package metadata, or lockfiles without a specific reviewed plan;
- target files, forbidden changes, verify commands, or repo root are missing;
- the target repo has unrelated dirty changes or stale base evidence;
- a worker run lacks valid `HARNESS_RESULT`;
- scope checks fail;
- deterministic verification fails and the allowed rework cycle is already
  spent;
- the next step requires push, secrets, connector expansion, remote adapters,
  daemon/watch behavior, or hidden state;
- the runner cannot update local evidence without ambiguity.

## Slice Queue

| Slice | Status | Objective | Dependency | Verification | Next Prompt |
| --- | --- | --- | --- | --- | --- |
| S0 | completed | Preserve the approved direction as this Initiative Continuity Brief. | BK approval in current plan request. | `git diff --check HEAD -- '*.md' 'references/**/*.md'`; optional `bun run samantha readiness:check --initiative=references/initiatives/sequential-ceo-autopilot.md`. | None. |
| S1 | completed | Write the Sequential CEO Autopilot design contract: artifact lifecycle, action type vocabulary, autonomy envelope, and stop conditions. Update only direction/playbook docs unless the plan exposes a deterministic enforcement need. | S0. | Created `references/playbooks/sequential-ceo-autopilot.md`; expected verification: file exists, contract terms are present, readiness check passes, and markdown diff check passes. | None. |
| S2 | completed | Add a structured continuation artifact validator and tests. The validator should reject unsafe action types, missing stop conditions, push authority, hidden memory fields, and lifecycle-authorizing shortcuts. | S1. | Passed in S2 worker: `bun test tests/sequential-ceo-autopilot.test.ts`, `bun run typecheck`, readiness check, and scoped diff check. | None. |
| S3 | completed | Add a report-only CLI surface that reads a continuation artifact and reports the current ready slice, blocking reasons, allowed action type, and exact next Samantha command. No execution. | S2. | Passed in S3 worker: `bun test tests/sequential-ceo-autopilot.test.ts`; `bun test tests/cli.test.ts`; `bun run typecheck`; readiness check; scoped diff check. | None. |
| S4 | ready | Add deterministic status update support after externally supplied evidence: mark a slice completed, blocked, or failed only from cited run/readiness/report evidence. No automatic next execution yet. | S3. | Focused status-transition tests; CLI tests; `bun run typecheck`. | `sam c: references/initiatives/sequential-ceo-autopilot.md 의 S4를 수행해. cited evidence 기반 continuation status update를 추가하되 worker output text만으로 trusted state를 만들지 마.` |
| S5 | pending | Add guarded single-step continuation: execute exactly one ready slice when its action type is explicit and allowed, then stop with evidence and next status. | S4. | Focused one-step runner tests with fake actions; existing run-task/batch tests as needed; `bun run typecheck`. | `sam c: references/initiatives/sequential-ceo-autopilot.md 의 S5를 수행해. allowed action type 하나만 실행하는 guarded single-step continuation을 추가하고 multi-step loop는 아직 구현하지 마.` |
| S6 | pending | Add bounded multi-step continuation: continue across successful slices until a stop condition, with failed-evidence rework limited to one cycle and push still forbidden. | S5 plus dogfood evidence from at least one safe initiative. | Focused loop tests with fake actions; dogfood run on docs-only or report-only initiative; `bun run typecheck`; no push. | `sam c: references/initiatives/sequential-ceo-autopilot.md 의 S6를 수행해. successful continuation loop를 추가하되 stop condition과 maxFailedEvidenceReworkCycles=1을 deterministic하게 검증해.` |
| S7 | pending | Dogfood the full MVP on a small Samantha self-build initiative and update this brief with outcomes, blocked edges, and whether broader routine use is justified. | S6. | Real run evidence; readiness check; initiative brief update; no push automation. | `sam c: references/initiatives/sequential-ceo-autopilot.md 의 S7을 수행해. 작은 self-build initiative로 Sequential CEO Autopilot MVP를 dogfood하고 결과와 다음 결정을 문서화해.` |

## Current Next Slice

S4 is ready.

S3 added only the report-only `continuation:show --artifact=<path>` CLI surface,
core report summarizer, and focused tests. It reads and validates a structured
continuation artifact, prints deterministic JSON, returns non-zero for rejected
artifacts, and leaves `trustedStateChanges` and `pushPerformed` false. It does
not execute, dispatch, mutate lifecycle state, write run logs, create
worktrees, push, update the artifact, or continue automatically.

S4 should add deterministic status update support after externally supplied
evidence. It must not create trusted state from worker prose or report-only
recommendations alone.

## End-of-Session Update Rule

Every session that works on this initiative must update this brief before
stopping:

- mark the completed or blocked slice status;
- record verification results;
- add newly discovered stop conditions or non-goals;
- set exactly one next slice to `ready` when no slice is active;
- keep next prompts current and executable through Samantha gates.

## Completion Rule

The MVP is complete when Samantha can consume a structured continuation
artifact for a small approved initiative, execute allowed slices through
existing gates until a stop condition, update local evidence, and report the
final status without BK issuing a new command for every successful slice.

Push automation, daemon/watch behavior, external agent orchestration, and broad
natural-language ROADMAP execution remain outside completion.
