# Lesson Candidate: 2026-05-24T05-16-26Z-structured-fanout-stale-base-replay-boundary

## Source
- Source run id: 2026-05-24T05-16-26Z-structured-fanout-stale-base-replay-boundary
- Task id: structured-fanout-stale-base-replay-boundary
- Task title: Separate worker-run evidence from current-base replay promises
- Run log: n/a - curated from Structured Agent Fanout Autopilot S5 evidence-boundary recovery

## Evidence
- Observed outcome: pass

### Source Artifacts
- `references/operations/structured-agent-fanout-s5-dogfood-report.md`
- `references/operations/structured-agent-fanout-s5-current-head-replay-report.md`
- `references/initiatives/structured-agent-fanout-autopilot.md`
- `runs/2026-05-23T08-46-18-659Z-structured-agent-fanout-s5-dogfood-batch-plan-candidate.json`

### Verification Summary
- `bun run typecheck` -> pass (0)
- `bun test tests/sequential-ceo-autopilot.test.ts tests/cli.test.ts tests/batch-spec.test.ts tests/batch-execution.test.ts tests/report-orchestration.test.ts tests/policy.test.ts` -> pass (0)
- Current-head replay of the S5 BatchSpec preflight artifact is expected to block when the repository HEAD differs from the pinned BatchSpec `baseCommit`.

### Lifecycle
- Lifecycle state: evidence-only lesson candidate

### Superseded Context
- Superseded status: not detected

### Recurrence
- Task family: structured-agent-fanout-autopilot
- Recurrence outcome: pass
- Recurrence count: 1
- Promotion threshold: 2

## Proposed Lesson
- Proposed lesson: Accepted worker-run evidence proves the gate state at the worker run's base. It must not be worded as a promise that the same committed artifact will remain accepted after the target repository base advances.
- Affected layer: playbook
- Suggested artifact type: playbook promotion candidate
- Risk if adopted: Overemphasizing stale-base replay can confuse operators into rerunning valid historical evidence unnecessarily instead of treating it as point-in-time evidence.
- Review note: Candidate evidence only. Later current-base replay should block stale-base with false side effects when a BatchSpec pins an older `baseCommit`.
