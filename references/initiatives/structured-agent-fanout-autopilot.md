# Initiative: Structured Agent Fanout Autopilot

Status: proposed
Source: Samantha worker task `structured-agent-fanout-autopilot-docs`.
Last updated: 2026-05-23

## Goal

Let Samantha use structured report fanout and existing batch gates to reduce
BK's manual coordination burden without granting workers orchestration
authority.

The accepted direction is A+B+trusted-transition:

- A: `reportFanoutCandidate` may request report/spec/reviewer/evaluator fanout
  as advice only.
- B: `batchPlanCandidate` may route accepted synthesis toward existing Phase
  5.5 `BatchPlanDraft` and Phase 5 `BatchSpec` gates.
- trusted-transition: advice becomes Samantha state only after deterministic
  synthesis, cited status evidence, and the ordinary Samantha gates accept it.

The useful loop is:

```text
approved initiative
-> structured continuation artifact
-> closed reportFanoutCandidate or batchPlanCandidate
-> advice-only fanout or existing batch preflight
-> deterministic synthesis/status evidence
-> existing Samantha gate or stop report
```

## Accepted Decisions

- Structured Agent Fanout Autopilot extends the Sequential CEO Autopilot
  direction. It coordinates broader advice and batch planning through
  structured continuation artifacts instead of prose scheduling.
- A report/spec/reviewer/evaluator fanout is advice-only until deterministic
  synthesis/status evidence accepts it. Worker summaries, reviewer prose, or
  evaluator opinions cannot mark a slice completed, dispatch writers, mutate
  lifecycle state, or spend rework budget by themselves.
- B must reuse existing Phase 5.5 `BatchPlanDraft` and Phase 5 `BatchSpec`
  gates. It must not create a parallel batch-planning or batch-execution
  authority surface.
- C, worker-owned subagent orchestration, remains forbidden. Workers must not
  spawn, coordinate, delegate to, or merge outputs from subagents.
- Any future execution-enabling field must be distinct from a report-only
  candidate field and must preserve Samantha-owned orchestration,
  verification, lifecycle, and commit/report gates.

## Rejected Alternatives

- Natural-language-only dispatch from markdown goals, roadmap prose, or command
  strings.
- WriterCap-only parallelism that increases concurrency without disjoint
  write-set proof, serial-only handling, integration order, and lifecycle
  evidence.
- Worker-owned orchestration, including worker-created subagents or worker-run
  fanout loops.
- Push automation, daemon/watch services, dashboards, remote adapters,
  connector expansion, hidden memory, CEO-office memory, routines, budget
  governance, or multi-project orchestration.
- Treating `BatchPlanDraft` advice, report fanout output, evaluator prose, or a
  reviewer summary as trusted completion evidence.

## Initiative Boundary

This initiative may design and later implement deterministic report-only
visibility, synthesis, and candidate validation for structured fanout and batch
planning.

It must not weaken existing gates:

- Samantha owns orchestration, worktree allocation, worker dispatch,
  deterministic verification, integration, lifecycle records, cleanup, local
  commit/report, and push refusal.
- Report-only workers may produce advice only when Samantha explicitly
  dispatches them through a reviewed future surface.
- Writer work remains bounded by task specs, target files, forbidden changes,
  verify commands, isolated worktrees, `HARNESS_RESULT`, scope checks, and
  Samantha-owned lifecycle records.
- Batch planning and execution remain under Phase 5.5 `BatchPlanDraft`
  validation/promotion and Phase 5 `BatchSpec` preflight/execution.

## Lifecycle

Structured Agent Fanout Autopilot should use reviewable local artifacts only:

```text
approved initiative
-> structured continuation artifact
-> closed candidate object
-> advice-only report fanout or existing batch gate report
-> deterministic synthesis/status report
-> trusted next action or stop condition
```

`reportFanoutCandidate` is a closed report-only object. It can name the report
roles, source artifacts, expected outputs, and false side-effect contract. It
does not authorize writer dispatch, task execution, lifecycle mutation, merge,
cleanup, commit, push, or successor execution.

`batchPlanCandidate` is a closed object for Phase 5.5/Phase 5 coordination. It
can point to a `BatchPlanDraft`, promotion/preflight expectation, or batch gate
report, but any preparation, promotion, preflight, execution, integration, and
cleanup must be performed by the existing batch commands and evidence chain.

## Authority Gates

- Validate the current structured continuation artifact before reading optional
  candidate or execution fields.
- Reject open-schema candidates, prose successor paths, command-string
  successors, off-repo paths, stale evidence, active stop conditions, push
  requests, and unknown action types.
- Keep report-only candidate objects separate from future execution objects.
  A candidate with `executionMode: report_only` or `preflight_only` is never an
  execution trigger.
- Require deterministic synthesis/status evidence before advice can affect
  continuation state.
- Require Phase 5.5 and Phase 5 gates before any batch planning advice becomes
  writer execution.

## Stop Conditions

Stop before continuing when any of these appear:

- BK product, priority, scope, or authority decision is needed.
- The next action would rely on prose dispatch, worker summaries, reviewer
  opinions, or evaluator text as trusted state.
- The candidate object is missing, malformed, open-schema, stale, cyclic,
  off-repo, or inconsistent with the current continuation artifact.
- The requested step needs worker-owned orchestration, writerCap-only
  parallelism, push automation, daemon/watch behavior, dashboards, remote
  adapters, connector expansion, hidden memory, routines, budget governance, or
  multi-project orchestration.
- A batch path bypasses Phase 5.5 `BatchPlanDraft` validation/promotion or
  Phase 5 `BatchSpec` preflight/execution gates.
- Verification, scope checks, `HARNESS_RESULT`, lifecycle evidence, or cleanup
  evidence is missing or failed.

## Slice Roadmap

| Slice | Status | Objective | Verification |
| --- | --- | --- | --- |
| S0 | completed | Create this initiative brief and the design contract playbook. | Markdown files exist, required contract terms are present, and scoped diff check passes. |
| S1 | proposed | Implement report-only validation and visibility for closed `reportFanoutCandidate` objects. No fanout dispatch. | Focused validator/CLI tests prove accepted and blocked candidates, false side effects, and no runs/worktrees/lifecycle mutation. |
| S2 | proposed | Dogfood S1 against one accepted and one blocked report/spec/reviewer/evaluator fanout candidate. | Operation report cites CLI output, accepted/blocked reasons, and false writer/batch/push side effects. |
| S3 | proposed | Add deterministic synthesis/status evidence for report fanout outputs. No writer or batch execution. | Tests prove advice cannot update status without cited synthesis evidence and conflicting advice blocks instead of averaging. |
| S4 | proposed | Add report-only `batchPlanCandidate` validation that reuses Phase 5.5 `BatchPlanDraft` and Phase 5 `BatchSpec` gates. No batch execution. | Tests prove accepted/blocked batch candidates and rejection of any parallel batch authority. |
| S5 | proposed | Dogfood S4 against existing Phase 5.5/Phase 5 fixtures and decide whether guarded batch execution coordination is justified. | Report cites existing batch gate evidence and recommends stop or next reviewed implementation slice. |

## Dogfood Evidence Expectations

Dogfood must include accepted and blocked examples. Evidence should show the
structured continuation artifact path, candidate object, exact command run,
deterministic accepted/blocked status, cited synthesis or batch-gate evidence,
remaining rework budget, and explicit false side effects for writer dispatch,
batch execution, lifecycle mutation, commit, push, successor execution,
daemon/watch, remote adapter, dashboard, connector expansion, and hidden
memory.

Dogfood reports are evidence, not authority. The next trusted transition still
requires deterministic status acceptance and the existing Samantha gates.

## First Implementation Slice

S1 is the first implementation slice: add only closed-schema
`reportFanoutCandidate` validation and report-only visibility. It must not
dispatch agents, create run logs, create worktrees, mutate lifecycle state,
write batch artifacts, execute `run_task`, execute `batch_plan`, commit, push,
or infer work from natural language.
