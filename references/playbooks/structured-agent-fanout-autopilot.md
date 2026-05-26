# Structured Agent Fanout Autopilot Design Contract

Last updated: 2026-05-23

## Purpose

Structured Agent Fanout Autopilot defines how Samantha may coordinate
report/spec/reviewer/evaluator advice and batch-planning candidates without
turning worker output into trusted state.

The contract is deliberately narrow. It describes structured continuation
artifacts, closed candidate/execution objects, trusted evidence boundaries,
report synthesis rules, side-effect contracts, validation boundaries, and stop
conditions for a future deterministic implementation.

## Product Boundary

Structured Agent Fanout Autopilot may coordinate two advice-to-action paths:

- A: `reportFanoutCandidate` for report/spec/reviewer/evaluator fanout.
- B: `batchPlanCandidate` for Phase 5.5 `BatchPlanDraft` and Phase 5
  `BatchSpec` coordination.

C, worker-owned subagent orchestration, remains forbidden. Workers must not
spawn subagents, coordinate fanout, merge report outputs, allocate worktrees,
dispatch other workers, or decide lifecycle state.

Natural-language-only dispatch, writerCap-only parallelism, push automation,
background operation, operator UIs, integration/control-plane entrypoints,
connector expansion, hidden memory, scheduled automation, budget governance,
and multi-project orchestration are out of scope.

## Structured Continuation Artifacts

The structured continuation artifact remains the trusted routing input. It must
validate before any optional fanout or batch candidate is inspected.

Required responsibilities:

- cite the initiative path and current slice;
- declare one action type and current status;
- declare dependencies, target files, forbidden files, and verify commands when
  writes may later occur through existing gates;
- include autonomy envelope values with `pushAllowed: false`;
- list active stop conditions;
- cite evidence used for the last trusted transition;
- carry optional closed candidate objects only after predecessor validation.

The artifact may preserve context. It must not replace task specs, run logs,
Phase 5.5 `BatchPlanDraft` evidence, Phase 5 `BatchSpec` evidence, lifecycle
records, verification output, or Samantha-owned commits/reports.

## Candidate And Execution Objects

Authority-bearing surfaces use paired closed objects:

- `reportFanoutCandidate`: report-only candidate for advice fanout.
- `reportFanoutExecution`: future explicit execution object, if Samantha later
  approves report-only fanout dispatch.
- `batchPlanCandidate`: report-only candidate for Phase 5.5/Phase 5 batch
  planning visibility.
- `batchPlanExecution`: future explicit execution object, if Samantha later
  approves guarded batch preparation or execution coordination through existing
  gates.

Candidate objects are not execution triggers. Candidate execution modes are limited to `report_only` and `preflight_only`; future execution modes require reviewed code and contract updates. Those modes must produce reports, not side effects.

`reportFanoutCandidate` should name the requested roles, source artifacts,
expected report paths, synthesis requirements, and false side-effect contract.
It must reject prose-only successors, command strings, unknown roles, missing
sources, off-repo paths, stale evidence, and any writer authority request.

`batchPlanCandidate` should name the `BatchPlanDraft` or batch gate evidence it
expects, the Phase 5.5/Phase 5 gate being inspected, and the required false
side-effect contract. It must reject any path that bypasses draft validation,
promotion, BatchSpec preflight, disjoint write-set proof, serial-only handling,
worker evidence, ordered integration, lifecycle records, or cleanup evidence.

## Trusted Evidence Boundaries

Report fanout output is advice only. A report/spec/reviewer/evaluator result
can inform a synthesis report, but it cannot complete a slice, approve a batch,
dispatch writers, mutate lifecycle state, or spend rework budget by itself.

Trusted state may come only from structured local evidence:

- validated continuation artifacts;
- deterministic candidate reports;
- deterministic synthesis/status reports;
- committed task specs when writer work is later involved;
- Phase 5.5 `BatchPlanDraft` validation/promotion reports;
- Phase 5 `BatchSpec` preflight/execution reports;
- worker run logs with valid `HARNESS_RESULT`;
- scope checks, verification output, lifecycle records, cleanup evidence, and
  Samantha-owned local commit/report gates.

LLM summaries may classify, draft, or synthesize. Deterministic code must own
routing, status-code handling, retry limits, scope acceptance, lifecycle
acceptance, and state transitions.

## Report Synthesis Rules

Synthesis reports must:

- cite every input artifact and command output used;
- classify each input as advice, deterministic evidence, or trusted lifecycle
  evidence;
- produce a closed status such as accepted, blocked, rejected, or needs
  decision;
- name conflicts instead of averaging them;
- preserve dissenting reviewer/evaluator findings when they affect risk;
- explain which deterministic evidence, if any, can update continuation state;
- emit the next safe Samantha command or a blocked handoff.

A report synthesis may recommend a `batchPlanCandidate` or future task slice.
It must not claim the candidate is trusted until deterministic validation and
the existing Samantha gate accept it.

## Side-Effect Contracts

Every candidate, execution report, and synthesis report must include explicit
side-effect evidence. A flag may be true only when that exact side effect was
allowed, attempted, and evidenced by the current Samantha gate.

Expected false flags for report-only candidate handling include writer worker
dispatch, worktree creation, run log creation, lifecycle mutation, merge,
cleanup, commit, push, `run_task`, `batches:execute`, successor execution,
background/watch operation, integration entrypoints, operator UI, connector
expansion, hidden-memory write, and worker-owned orchestration.

Batch-related true flags are allowed only when produced by existing Phase 5.5
or Phase 5 commands. Structured Agent Fanout Autopilot must report those
results; it must not reimplement the batch gate.

## Validation Boundaries

Validation order is mandatory:

1. Validate the current structured continuation artifact.
2. Reject active stop conditions and push requirements.
3. Validate the closed candidate object.
4. Validate cited source paths and evidence freshness.
5. Validate expected side effects.
6. Build a deterministic accepted/blocked/rejected report.
7. Update trusted status only through a separate deterministic status
   transition that cites accepted evidence.

Invalid predecessors must produce blocked candidate reports. They must not be
reported as absent candidates or skipped optional fields.

Validation must reject unknown fields, unknown action types, open-ended role
lists, prose paths, command-string paths, URLs, absolute paths, traversal,
environment expansion, globs, missing files, off-repo files, stale evidence,
cycles, dirty-repo risks, push requests, hidden state, and connector expansion.

## Stop Conditions

Stop before continuing when any condition is active:

- the next step needs a BK product, scope, priority, or authority decision;
- current artifact validation fails;
- candidate validation fails or conflicts with the current slice;
- synthesis inputs conflict in a way that affects trust, scope, or authority;
- advice lacks deterministic synthesis/status evidence;
- a report tries to authorize writer work, lifecycle mutation, commit, push, or
  batch execution directly;
- a batch path bypasses Phase 5.5 `BatchPlanDraft` or Phase 5 `BatchSpec`
  gates;
- the step requires worker-owned orchestration, natural-language-only
  dispatch, writerCap-only parallelism, push automation, background operation,
  operator UIs, integration/control-plane entrypoints, connector expansion,
  hidden memory, scheduled automation, budget governance, or multi-project
  orchestration;
- `HARNESS_RESULT`, scope checks, verification output, lifecycle records, or
  cleanup evidence is missing or failed;
- the runner cannot report the next safe command without inventing facts.

The stop report must cite evidence, name the exact blocked boundary, preserve
false side-effect flags, and hand back the next safe Samantha command or BK
decision.
