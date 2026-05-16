# Lesson Candidate: 2026-05-16T05-15-18-040Z-sdk-failed-recovery-dogfood

## Source
- Source run id: 2026-05-16T05-15-18-040Z-sdk-failed-recovery-dogfood
- Task id: sdk-failed-recovery-dogfood
- Task title: Dogfood SDK failed-run recovery
- Run log: /Users/byung/Documents/samantha/runs/2026-05-16T05-15-18-040Z-sdk-failed-recovery-dogfood.json

## Evidence
- Observed outcome: verify_failed
- Failure reason: verify command failed (1): grep -F 'SDK failed recovery marker: follow-up can fix this' references/initiatives/sdk-adapter-s7-failed-dogfood.md

### Changed Files
- `references/initiatives/sdk-adapter-s7-failed-dogfood.md`

### Verification Summary
- 0 passed, 1 failed
- `grep -F 'SDK failed recovery marker: follow-up can fix this' references/initiatives/sdk-adapter-s7-failed-dogfood.md` -> fail (1)

### Lifecycle
- Lifecycle state: not recorded

### Superseded Context
- Superseded status: not detected

### Recurrence
- Task family: sdk-failed-recovery-dogfood
- Recurrence outcome: verify_failed
- Recurrence count: 2
- Promotion threshold: 2

## Proposed Lesson
- Proposed lesson: Design failed-run recovery dogfood with fixable failures. The
  source run should fail a focused verification command that a generated
  follow-up can satisfy, not a permanent command that always exits non-zero.
- Affected layer: task template / playbook
- Suggested artifact type: playbook or dogfood task template guidance
- Risk if adopted: Over-constraining dogfood failures can make tests less
  realistic; keep the failure realistic enough to exercise evidence, scope, and
  recovery while still allowing a bounded fix.
- Review note: Review manually before promotion. This candidate must not modify promoted artifacts by itself.

## Session Note

This session first used an intentionally permanent failing verify command for
SDK failed-run recovery dogfood. That proved `tasks:from-run` could create a
follow-up, but the follow-up could not realistically pass without changing the
task contract. The task was corrected to fail on a missing marker line instead.
That second run produced a useful recovery chain:

- Source failed run:
  `runs/2026-05-16T05-15-18-040Z-sdk-failed-recovery-dogfood.json`
- Generated follow-up:
  `references/tasks/sdk-failed-recovery-follow-up.json`
- Passing follow-up run:
  `runs/2026-05-16T05-16-42-812Z-sdk-failed-recovery-follow-up.json`

The reusable pattern is: make recovery dogfood fail because the artifact is
incomplete, not because verification is impossible.
