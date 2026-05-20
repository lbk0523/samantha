# Sequential CEO Autopilot S10 Action Coordination Boundary

Date: 2026-05-20

## Purpose

S10 is a report-only and design-only slice. It dogfoods S9/S9.1
`nextArtifactPath` linkage and records the boundary for future `run_task` and
`batch_plan` coordination. It does not add action execution.

The useful next capability is coordination through existing Samantha gates, not
a new executor. Continuation may point at the next reviewed gate only after the
current artifact validates and local evidence supports the transition.

## Report-Only Linkage Result

S10 uses operation artifacts under `references/operations`:

- `sequential-ceo-autopilot-s10-linkage-predecessor.json` is a valid S10
  predecessor with `nextArtifactPath` pointing at the S11 successor artifact.
- `sequential-ceo-autopilot-s10-linkage-successor.json` is a valid S11
  report-only successor that cites the S10 predecessor artifact as local
  freshness evidence.
- `sequential-ceo-autopilot-s10-linkage-invalid-predecessor.json` is a narrow
  invalid predecessor. Its only intended schema violation is `pushAllowed:
  true`, so `continuation:show` must block before inspecting successor linkage.

This proves only report visibility. It does not execute the successor.

## run_task Coordination Boundary

Future `run_task` coordination may only route to a committed TaskSpec through
existing run-task gates.

Required gates:

1. The continuation artifact names an existing committed `taskSpecPath`.
2. Existing run-task preflight passes, including target files, forbidden
   changes, verify commands, agent profile, repo cleanliness, stale-base checks,
   and policy checks.
3. Execution uses SDK runtime.
4. Samantha allocates the isolated worktree.
5. The worker run produces `HARNESS_RESULT`.
6. Samantha checks changed-file scope against the TaskSpec.
7. Deterministic verification passes or the existing rework/blocked path is
   used.
8. Samantha owns accept, merge, lifecycle record, cleanup, and local
   commit/report gates.

Continuation may coordinate the next gate after evidence exists. It must not
dispatch the worker, create the worktree, accept scope, merge, clean up, commit,
or push.

## batch_plan Coordination Boundary

Future `batch_plan` coordination must preserve the existing Phase 5.5 and Phase
5 boundaries.

Required gates:

1. Phase 5.5 `BatchPlanDraft` review remains planning evidence and cannot
   dispatch workers.
2. Phase 5 `BatchSpec` preparation remains the promotion gate for executable
   batch work.
3. Preflight proves dependencies, disjoint write sets, and serial-only handling
   for contracts, policy, package metadata, lockfiles, task templates, agent
   profiles, and doctrine documents.
4. Worker execution remains Samantha-owned and produces independent worker run
   evidence with `HARNESS_RESULT`.
5. Samantha performs ordered integration.
6. Focused verification runs after each accepted merge.
7. Broader batch verification runs after the final accepted merge.
8. Lifecycle records, stale-base handling, partial-failure handling, cleanup,
   and local commit/report gates remain Samantha-owned.

Continuation may route to reviewed Phase 5.5 or Phase 5 commands only after the
required artifact is present and validated. It must not replace draft review,
preparation, preflight, disjoint write-set proof, serial-only handling, worker
run evidence, ordered integration, lifecycle, or cleanup.

## S11 Recommendation

S11 should be a reviewed `run_task` coordination design or preflight-only slice.
It should prove that a continuation artifact can name a committed TaskSpec and
report the existing run-task gate status without executing `run_task`.

S11 should not run a task yet. Execution becomes safe only after the preflight
boundary proves the artifact fields, repo-root handling, worktree ownership,
scope checks, verification handoff, lifecycle evidence, and stop behavior are
deterministic.

## Non-Goals

- No action execution in S10.
- No source or tests changes.
- No worker dispatch from continuation.
- No `taskSpecPath` or `batchSpecPath` dispatch.
- No batch execution.
- No merge, cleanup, commit, or push.
- No daemon or watch service.
- No remote adapter.
- No dashboard.
- No routine trigger.
- No hidden memory.
- No broad roadmap execution.
- No policy or doctrine change.
- No task template or agent profile change.
- No package change.
- No worker-owned orchestration.

## Stop Conditions Preserved

Stop before coordination when any requested next action lacks a committed
TaskSpec, reviewed BatchPlanDraft, prepared BatchSpec, deterministic verify
commands, SDK runtime, isolated worktree ownership by Samantha, valid
`HARNESS_RESULT`, changed-file scope checks, Phase 5.5 review, Phase 5
preflight, disjoint write-set proof, serial-only handling, worker run evidence,
ordered integration evidence, lifecycle record, cleanup evidence, or
Samantha-owned local commit/report gate.

Stop immediately for push requirements, active stop conditions, dirty or stale
repo evidence, hidden memory, daemon/watch behavior, remote adapters,
dashboards, routine triggers, broad natural-language roadmap execution,
off-repo successor paths, missing successor artifacts, invalid successors,
stale successor evidence, or predecessor validation failures.
