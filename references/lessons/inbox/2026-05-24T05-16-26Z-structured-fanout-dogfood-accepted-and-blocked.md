# Lesson Candidate: 2026-05-24T05-16-26Z-structured-fanout-dogfood-accepted-and-blocked

## Source
- Source run id: 2026-05-24T05-16-26Z-structured-fanout-dogfood-accepted-and-blocked
- Task id: structured-fanout-dogfood-accepted-and-blocked
- Task title: Dogfood new preflight surfaces with accepted and blocked examples
- Run log: n/a - curated from Structured Agent Fanout Autopilot dogfood reports

## Evidence
- Observed outcome: pass

### Source Artifacts
- `references/operations/structured-agent-fanout-s2-dogfood-report.md`
- `references/operations/structured-agent-fanout-s5-dogfood-report.md`
- `references/operations/structured-agent-fanout-s2-accepted-candidate.json`
- `references/operations/structured-agent-fanout-s2-blocked-candidate.json`
- `references/operations/structured-agent-fanout-s5-batch-plan-review-accepted.json`
- `references/operations/structured-agent-fanout-s5-batch-plan-review-blocked.json`
- `references/operations/structured-agent-fanout-s5-batch-spec-preflight-accepted.json`
- `references/operations/structured-agent-fanout-s5-batch-spec-preflight-blocked.json`

### Verification Summary
- `bun run typecheck` -> pass (0)
- `bun test tests/sequential-ceo-autopilot.test.ts tests/cli.test.ts tests/batch-spec.test.ts tests/batch-execution.test.ts tests/report-orchestration.test.ts tests/policy.test.ts` -> pass (0)
- Accepted dogfood examples showed `reportFanoutPreflight.status: accepted` and `batchPlanPreflight.status: accepted`.
- Blocked dogfood examples showed deterministic blocking reasons while preserving false side effects.

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
- Proposed lesson: A new Samantha preflight or visibility surface is not dogfooded until both an accepted case and a blocked case are recorded. The blocked case must prove deterministic reasons and false side effects, not just command failure.
- Affected layer: playbook
- Suggested artifact type: playbook promotion candidate
- Risk if adopted: Requiring blocked examples for every tiny validation can add fixture noise unless limited to authority, orchestration, lifecycle, or execution-adjacent surfaces.
- Review note: Candidate evidence only. Expected non-zero output may count as successful dogfood evidence only when the report validates the predecessor, records a deterministic blocked reason, and keeps execution side effects false.
