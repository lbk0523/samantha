# Playbook: cli-core-command-with-tests

## Source
- Promoted from: /Users/byung/Documents/samantha/references/lessons/inbox/2026-05-13T03-48-10-822Z-add-tasks-from-run-command.md
- Source run id: 2026-05-13T03-48-10-822Z-add-tasks-from-run-command
- Task id: add-tasks-from-run-command
- Task title: Add tasks from run command
- Run log: /Users/byung/Documents/samantha/runs/2026-05-13T03-48-10-822Z-add-tasks-from-run-command.json

## Lesson
- Proposed lesson: Preserve this task shape as a candidate repeatable pattern only if it recurs.
- Affected layer: playbook
- Suggested artifact type: playbook
- Risk if adopted: Promoting one smooth run too early can turn a lucky path into unnecessary doctrine.

## Evidence
- Observed outcome: pass
- Superseded status: not detected

## Later Evidence
- Run id: 2026-05-13T06-03-53-985Z-expose-runs-show-lifecycle-v2
  - Run log: /Users/byung/Documents/samantha/runs/2026-05-13T06-03-53-985Z-expose-runs-show-lifecycle-v2.json
  - Task id: expose-runs-show-lifecycle-v2
  - Task title: Expose lifecycle evidence in runs show
  - Outcome: pass
  - Assessment: unclear
  - Note: Historical repeat of the CLI core command with focused tests shape; useful as recurrence evidence, but not proof the playbook helped because the run predates promotion.
- Run id: 2026-05-13T10-20-43-354Z-expose-task-creation-repo-root-v2
  - Run log: /Users/byung/Documents/samantha/runs/2026-05-13T10-20-43-354Z-expose-task-creation-repo-root-v2.json
  - Task id: expose-task-creation-repo-root-v2
  - Task title: Expose repo root for task creation commands
  - Outcome: pass
  - Assessment: helped
  - Note: Applied as advisory guidance for a small CLI/core connection task; it helped keep the change to parser coverage plus deterministic verification without promoting broader doctrine.

## Use

Apply this playbook only when new run evidence matches the source pattern.
