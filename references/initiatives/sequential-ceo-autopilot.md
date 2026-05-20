# Initiative: Sequential CEO Autopilot

Status: active
Source: Samantha brainstorm and plan on 2026-05-19 about reducing BK's
midstream scheduler burden while preserving Samantha's execution gates.
Last updated: 2026-05-20

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
- Next-artifact linkage must be a closed-schema explicit local path field such
  as `nextArtifactPath`, or an equivalent reviewed field. It must never be
  inferred from markdown prose or command strings.
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
- requested multi-step continuation lacks an explicit validated next artifact;
- the named next artifact is missing, off-repo, cyclic, stale, or fails
  independent validation;
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
| S4 | completed | Add deterministic status update support after externally supplied evidence: mark a slice completed, blocked, or failed only from cited run/readiness/report evidence. No automatic next execution yet. | S3. | Passed in S4 worker: focused status-transition tests, CLI update-status tests, typecheck, readiness check, and scoped diff check. | None. |
| S5 | completed | Add guarded single-step continuation: execute exactly one ready slice when its action type is explicit and allowed, then stop with evidence and next status. | S4. | Passed in S5 worker: focused one-step runner tests, CLI step tests, typecheck, readiness check, and scoped diff check. | None. |
| S6 | completed | Add bounded multi-step continuation: continue across successful slices until a stop condition, with failed-evidence rework limited to one cycle and push still forbidden. | S5 plus dogfood evidence from at least one safe initiative. | Passed in S6 worker: focused fake-artifact loop tests for two successful readiness slices, maxSteps cutoff, status-evidence rejection, one failed-evidence rework cycle, and false side-effect flags; CLI tests cover parser/main loop behavior, blocked stops, rejected artifacts, and no runs/worktrees side effects; typecheck, readiness check, and scoped diff check passed. | None. |
| S7 | completed | Dogfood the full MVP on a small Samantha self-build initiative and update this brief with outcomes, blocked edges, and whether broader routine use is justified. | S6. | Passed: created `references/initiatives/sequential-ceo-autopilot-s7-dogfood.md` and `references/operations/sequential-ceo-autopilot-s7-continuation.json`; ran `bun run samantha continuation:loop --artifact=references/operations/sequential-ceo-autopilot-s7-continuation.json --max-steps=2`; result accepted one readiness step, updated D1 to completed, preserved false side-effect flags, and stopped with `no_deterministic_next_artifact`; recorded `references/operations/sequential-ceo-autopilot-s7-dogfood-report.md`. | None. |
| S8 | completed | Design the next deterministic artifact-link and action-execution boundary before broad routine use. Keep this at CEO/product-boundary level: decide how next artifacts are named, how reviewed `run_task`/`batch_plan` support is authorized, and what stop conditions remain mandatory. | S7. | Created `references/initiatives/sequential-ceo-autopilot-s8-action-boundary.md`; expected verification: required headings present, S9 follow-up named, readiness check passes, and scoped diff check passes. | None. |
| S9 | completed | Add deterministic validation and report-only visibility for explicit next-artifact linkage before enabling writer action execution. Prefer a narrow `nextArtifactPath` validator/report-only slice that rejects prose or command-string successors, missing files, off-repo paths, cycles, stale evidence, active stop conditions, and push requirements. Do not execute `run_task` or `batch_plan`. | S8. | Passed in S9 worker: focused core tests for accepted local `nextArtifactPath` and rejection of prose, command strings, missing files, off-repo paths, path traversal, cycles, stale evidence, active stop conditions, push requirements, mismatched expected slice ids, and invalid successor artifacts; CLI tests prove `continuation:show` reports next-artifact accepted/blocked status and reasons without creating runs or worktrees; typecheck, readiness check, and scoped diff check passed. | None. |
| S10 | ready | Dogfood S9 report-only next-artifact linkage and design the reviewed action coordination boundary for future `run_task` / `batch_plan` support. Keep this report-only or design-only: no worker dispatch, no batch execution, no merge, no cleanup, no commit/push automation. | S9. | Report-only dogfood evidence or design artifact demonstrates linked-artifact validation behavior and names the exact reviewed gates still required before action coordination; readiness check and scoped diff check pass. | `sam c: Implement S10 for references/initiatives/sequential-ceo-autopilot.md. Dogfood S9 report-only next-artifact linkage or write a narrow reviewed-action-coordination design for future run_task / batch_plan support. Do not execute run_task or batch_plan, dispatch workers, merge, cleanup, commit, push, or bypass Phase 5.5 / Phase 5 gates.` |

## Current Next Slice

S10 is ready.

S6 added bounded continuation through
`continuation:loop --artifact=<path> --max-steps=<n>`. The core loop builds on
the S5 single-step runner, continues only through injected deterministic next
artifacts, stops at `maxSteps`, preserves per-step reports, leaves
`pushPerformed` false, and reports false side-effect flags for run-task,
batch execution, worker dispatch, run logs, worktrees, and push. The CLI loop
uses the same readiness-check execution as `continuation:step`, updates only the
explicitly supplied artifact when status evidence is accepted, and stops after
that artifact with `no_deterministic_next_artifact` because the current artifact
contract cannot name the next artifact deterministically.

S7 dogfooded that behavior with
`references/operations/sequential-ceo-autopilot-s7-continuation.json`. The real
CLI run accepted one `readiness_check`, updated D1 to `completed`, preserved
false side-effect flags, and stopped with
`stopReason: no_deterministic_next_artifact`.

Broader routine use: not yet justified.

Readiness-only continuation works, and S8 has now documented the boundary for
deterministic next-artifact linkage plus reviewed `run_task`/`batch_plan`
coordination. S9 implemented only validator/report-only support for explicit
`nextArtifactPath` linkage before any writer action execution is enabled. The
next safe step is S10: dogfood that report-only linkage or write the reviewed
action-coordination design for future `run_task` / `batch_plan` support while
preserving the Phase 5.5 and Phase 5 boundaries.

## S7 Evidence And Decision

- Dogfood initiative:
  `references/initiatives/sequential-ceo-autopilot-s7-dogfood.md`
- Continuation artifact:
  `references/operations/sequential-ceo-autopilot-s7-continuation.json`
- Dogfood report:
  `references/operations/sequential-ceo-autopilot-s7-dogfood-report.md`
- Command:
  `bun run samantha continuation:loop --artifact=references/operations/sequential-ceo-autopilot-s7-continuation.json --max-steps=2`
- Outcome: accepted; one readiness step; D1 moved from `ready` to `completed`;
  `artifactUpdated: true`; false side-effect flags; `pushPerformed: false`;
  `stopReason: no_deterministic_next_artifact`.
- Blocked edges: no deterministic next-artifact linkage in the current artifact
  contract; no reviewed `run_task`/`batch_plan` execution path in the loop;
  no worker dispatch, batch execution, merge, cleanup, commit, push, daemon,
  remote adapter, dashboard, routine trigger, hidden memory, or broad roadmap
  execution authority.

## S8 Evidence And Decision

- Design artifact:
  `references/initiatives/sequential-ceo-autopilot-s8-action-boundary.md`
- Decision: next artifacts must be linked by a closed-schema explicit local
  path such as `nextArtifactPath`, or an equivalent reviewed field. They must
  never be inferred from markdown prose or command strings.
- Decision: the next artifact must validate independently before execution.
  Missing files, off-repo paths, cycles, stale evidence, dirty repo risk,
  active stop conditions, and push requirements stop continuation.
- Decision: `run_task` coordination requires a committed TaskSpec path,
  existing run-task gates, SDK runtime, isolated worktree, `HARNESS_RESULT`,
  changed-file scope checks, deterministic verify commands, and
  Samantha-owned accept/merge/cleanup lifecycle.
- Decision: `batch_plan` coordination preserves Phase 5.5 `BatchPlanDraft` and
  Phase 5 `BatchSpec` boundaries. It may only invoke reviewed existing gates
  and must not replace draft review, preparation, preflight, disjoint write-set
  proof, serial-only handling, worker execution, integration, lifecycle, or
  cleanup.
- Next slice: S9, validator/report-only support for deterministic
  `nextArtifactPath` linkage. Do not implement writer action execution in S9.

## S9 Evidence And Decision

- Implementation:
  `src/core/sequential-ceo-autopilot.ts`,
  `tests/sequential-ceo-autopilot.test.ts`, `src/cli.ts`, and
  `tests/cli.test.ts`.
- Decision: the closed continuation artifact schema now allows only two new
  optional successor fields: `nextArtifactPath` and
  `nextArtifactExpectedSliceId`.
- Decision: absent or `null` `nextArtifactPath` preserves the existing
  `no_deterministic_next_artifact` stop behavior.
- Decision: present `nextArtifactPath` is report-only validated as a normalized
  repo-relative local JSON artifact path, then the successor artifact is read
  and validated independently without executing it.
- Decision: linkage blocks on prose or command strings, URLs, absolute paths,
  traversal, environment expansion, globs, empty strings, missing successor
  files, invalid successors, initiative mismatch, expected slice mismatch,
  active stop conditions, push requirements, artifact or slice cycles, and
  stale successor evidence.
- CLI visibility: `continuation:show` can report next-artifact accepted/blocked
  status and deterministic blocking reasons. It does not run `run_task`, run
  `batch_plan`, dispatch workers, create run logs, create worktrees, mutate
  lifecycle state, commit, or push.
- S9.1 correction: next-artifact linkage reports now validate the predecessor
  artifact before consuming `nextArtifactPath` or
  `nextArtifactExpectedSliceId`. Invalid predecessors produce blocked linkage
  reports, not absent linkage reports, even when successor linkage is absent,
  `null`, or malformed.
- S9.1 evidence: focused core tests cover non-string successor linkage plus
  absent and `null` linkage on invalid predecessors; focused CLI tests cover
  `continuation:show` exposing blocked linkage and deterministic blocking
  reasons for malformed non-string linkage.
- Verification: `bun test tests/sequential-ceo-autopilot.test.ts`,
  `bun test tests/cli.test.ts`, `bun run typecheck`,
  `bun run samantha readiness:check --initiative=references/initiatives/sequential-ceo-autopilot.md`,
  and scoped `git diff --check` passed in the S9 worker.
- Next slice: S10, report-only dogfood or reviewed action-coordination design
  for future `run_task` / `batch_plan` support. Preserve Phase 5.5 draft review
  and Phase 5 batch gates; do not execute writer actions in S10.

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
