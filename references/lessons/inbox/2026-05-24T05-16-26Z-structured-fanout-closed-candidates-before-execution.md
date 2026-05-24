# Lesson Candidate: 2026-05-24T05-16-26Z-structured-fanout-closed-candidates-before-execution

## Source
- Source run id: 2026-05-24T05-16-26Z-structured-fanout-closed-candidates-before-execution
- Task id: structured-fanout-closed-candidates-before-execution
- Task title: Preserve closed candidate boundaries before new execution authority
- Run log: n/a - curated from Structured Agent Fanout Autopilot initiative evidence

## Evidence
- Observed outcome: pass

### Source Artifacts
- `references/initiatives/structured-agent-fanout-autopilot.md`
- `references/playbooks/structured-agent-fanout-autopilot.md`
- `src/core/sequential-ceo-autopilot.ts`
- `tests/sequential-ceo-autopilot.test.ts`

### Verification Summary
- `bun run typecheck` -> pass (0)
- `bun test tests/sequential-ceo-autopilot.test.ts tests/cli.test.ts tests/batch-spec.test.ts tests/batch-execution.test.ts tests/report-orchestration.test.ts tests/policy.test.ts` -> pass (0)
- `bun run samantha continuation:show --artifact=references/operations/structured-agent-fanout-s2-accepted-candidate.json --repo-root=.` -> pass (0)
- `bun run samantha continuation:show --artifact=references/operations/structured-agent-fanout-s5-batch-plan-review-accepted.json --repo-root=.` -> pass (0)

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
- Proposed lesson: New orchestration-like Samantha surfaces should start as closed candidate objects with report-only or preflight-only visibility. Execution objects must remain future authority until a separate reviewed slice proves the boundary.
- Affected layer: playbook
- Suggested artifact type: playbook promotion candidate
- Risk if adopted: If promoted too broadly, this can slow legitimate small features by forcing candidate artifacts where ordinary task specs are enough.
- Review note: Candidate evidence only. Do not treat `reportFanoutCandidate` or `batchPlanCandidate` as execution triggers, and do not promote `reportFanoutExecution` or `batchPlanExecution` without a separate reviewed plan.
