# Structured Agent Fanout S5 Current-Head Replay Report

Date: 2026-05-23

## Command

`bun run samantha continuation:show --artifact=references/operations/structured-agent-fanout-s5-batch-spec-preflight-accepted.json --repo-root=.`

## Current-Base Result

current-head replay status: blocked stale-base as expected

trusted evidence path: runs/2026-05-23T08-46-18-659Z-structured-agent-fanout-s5-dogfood-batch-plan-candidate.json

The recorded replay is a point-in-time current-base check; later repository bases may also block when they differ from the pinned BatchSpec base.

The replay exits non-zero when the repository base differs from the fixture
BatchSpec's pinned baseCommit 4f1b87966e45d8fabd72e3ba87c0c4a14ac50c56.
The trusted S5 accepted evidence remains the accepted worker run log, and
later repository bases that differ from the pinned BatchSpec baseCommit are
expected to block stale-base with all side effects false.

The stale-base blocking reason is `repoRoot HEAD must match baseCommit before dispatch`.

The replay output keeps the continuation artifact parsed as `status: accepted`,
but `batchPlanPreflight.status` is `blocked`,
`batchPlanPreflight.batchPreflight.mayDispatch` is `false`, and
`exactNextSamanthaCommand` is `stop`.

All side-effect flags remain false in the replay output:
`runTaskCalled=false`, `batchPlanPrepareCalled=false`,
`taskSpecsWritten=false`, `batchSpecsWritten=false`,
`batchesExecuteCalled=false`, `workersDispatched=false`,
`worktreesCreated=false`, `runsCreated=false`, `lifecycleMutated=false`,
`mergePerformed=false`, `cleanupPerformed=false`, `commitPerformed=false`,
`pushPerformed=false`, `successorExecuted=false`,
`daemonWatchStarted=false`, `remoteAdapterCalled=false`,
`dashboardUpdated=false`, `connectorExpansionPerformed=false`,
`hiddenMemoryWritten=false`, and `workerOwnedOrchestrationStarted=false`.
