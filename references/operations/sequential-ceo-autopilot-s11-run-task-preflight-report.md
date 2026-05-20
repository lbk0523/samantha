# Sequential CEO Autopilot S11 Run Task Preflight Report

Date: 2026-05-20

## Scope

S11 is the last design/report-only boundary before S12 implementation. It
turns the S10 action coordination boundary into a concrete preflight-only
`run_task` report design, while preserving the S10 dogfood proof that
continuation can inspect deterministic linkage without side effects.

Referenced S10 evidence:

- Dogfood report:
  `references/operations/sequential-ceo-autopilot-s10-dogfood-report.md`
- Action coordination boundary:
  `references/initiatives/sequential-ceo-autopilot-s10-action-coordination-boundary.md`

## Decision

S12 may implement deterministic report-only validation for a closed
`runTaskCandidate` object. It may report whether a committed TaskSpec candidate
would pass the existing run-task preflight boundary, but it must not execute the
task.

S11 closes the remaining design question because the required candidate fields,
validation order, stop conditions, evidence requirements, non-goals, and
follow-up slices are now documented in:

- `references/initiatives/sequential-ceo-autopilot-s11-run-task-preflight-boundary.md`

No additional design-only slice should be inserted before S12 unless review
finds a new authority boundary.

## Explicit Side-Effect Boundary

- No run_task execution.
- No batch_plan execution.
- no worker dispatch by continuation.
- no worktree creation by continuation.
- no lifecycle mutation.
- no merge, cleanup, commit, or push by continuation.
- no daemon/watch service.
- no remote adapter.
- no dashboard.
- no routine trigger.
- no hidden memory.
- no broad roadmap execution by continuation.

## Required S12 Output

S12 should implement only deterministic report-only output:

- `accepted` when a committed, clean, repo-local TaskSpec candidate satisfies
  `requiredRuntime: codex-sdk`, `executionMode: preflight_only`,
  Samantha-allocated isolated worktree ownership, Samantha lifecycle ownership,
  target-file handoff, forbidden-change handoff, verify-command handoff,
  freshness evidence, and false side-effect flags.
- `blocked` when any candidate field, file path, TaskSpec state, stop
  condition, stale evidence, push requirement, runtime mismatch, execution mode
  mismatch, ownership mismatch, or run-task preflight dependency fails.

The report must be deterministic evidence only. It must not allocate worktrees,
dispatch workers, write run logs, mutate lifecycle state, merge, clean up,
commit, or push.

## Recommendation

Proceed to S12 implementation only after this S11 documentation passes
readiness and scoped diff checks. Keep S12 focused on preflight reporting for
`runTaskCandidate`; do not add `batch_plan` support, guarded execution,
daemon/watch behavior, remote adapters, dashboards, routine triggers, hidden
memory, or broad roadmap execution.
