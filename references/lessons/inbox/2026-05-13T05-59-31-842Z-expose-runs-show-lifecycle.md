# Lesson Candidate: 2026-05-13T05-59-31-842Z-expose-runs-show-lifecycle

## Source
- Source run id: 2026-05-13T05-59-31-842Z-expose-runs-show-lifecycle
- Task id: expose-runs-show-lifecycle
- Task title: Expose lifecycle evidence in runs show
- Run log: /Users/byung/Documents/samantha/runs/2026-05-13T05-59-31-842Z-expose-runs-show-lifecycle.json

## Evidence
- Observed outcome: blocked
- Failure reason: typecheck blocked by missing @types/bun

### Changed Files
- `src/cli.ts`
- `src/core/run-show.ts`
- `tests/run-show.test.ts`

### Verification Summary
- not run

### Lifecycle
- Lifecycle state: not recorded

### Superseded Context
- Superseded status: superseded by accepted and cleaned run
- Superseding run id: 2026-05-13T06-03-53-985Z-expose-runs-show-lifecycle-v2
- Superseding task id: expose-runs-show-lifecycle-v2
- Superseding outcome: pass
- Superseding lifecycle state: merged and cleaned
- Superseding commit: b11b84335ed5cfb23633c24f8bdfe40fbb83eff8

## Proposed Lesson
- Proposed lesson: Treat this candidate as stale unless the same failure recurs after the superseding run.
- Affected layer: evidence
- Suggested artifact type: run summary / no promotion
- Risk if adopted: Promoting superseded evidence can add process for a problem that was already resolved.
- Review note: Review manually before promotion. This candidate must not modify promoted artifacts by itself.
