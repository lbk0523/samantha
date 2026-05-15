# Initiative: gstack-inspired Samantha readiness loop

Status: completed
Source: Samantha brainstorm on 2026-05-15 comparing Samantha with garrytan/gstack
Last updated: 2026-05-15

## Goal

Adopt the parts of gstack that help Samantha preserve context, expose readiness,
and finish multi-slice software work without weakening Samantha's deterministic
authority boundaries.

## Accepted Decisions

- Use an Initiative Continuity Brief as the parent artifact for multi-slice
  Samantha work.
- Store initiative briefs in `references/initiatives/`.
- Treat the brief as reviewable repo state, not hidden memory.
- Do not use `ROADMAP.md` for daily slice tracking.
- Do not use `~/Documents/llm-wiki/` for active Samantha execution queues.
- Bring over gstack ideas as Samantha-shaped artifacts and checks, not as a
  direct import of gstack's generated skills, browser daemon, or automatic
  memory.
- Use `readiness:check` as the v0 deterministic readiness surface.

## Non-Goals

- No daemon, dashboard, routine trigger, chat adapter, or remote-control plane.
- No automatic learning or cross-project hidden memory.
- No auto-merge, auto-deploy, browser daemon, or canary authority.
- No worker-owned orchestration.
- No task specs or worker dispatch from brainstorm by default.

## Invariants

- Executable work still flows through task specs, declared scope, isolated
  worktrees, run logs, deterministic verification, and Samantha-owned lifecycle
  gates.
- Report-only artifacts can advise but cannot grant trust or mutate lifecycle
  state.
- Authority changes require explicit review and focused tests when enforceable.
- Every slice should leave a fresh session with a concrete next action or a
  named stop condition.

## Readiness v0 Design

`readiness:check` is the first gstack-inspired readiness surface.

Inputs:

- `--initiative=<path>` checks an Initiative Continuity Brief.
- `--task=<task.json>` loads a task spec as the plan source.
- `--run-log=<path>` loads completed run evidence.

Output:

- JSON with `overallStatus`, `recommendation`, optional `initiative`, optional
  `planCompletion`, and flat `checks`.
- Check statuses are `clear`, `missing`, `stale`, or `blocked`.

Initiative checks:

- top-level status exists;
- required continuity sections exist;
- slice statuses use the approved vocabulary;
- at most one active slice, or one ready slice when no active slice exists;
- blocked slices are exposed;
- `Current Next Slice` points at the active or ready slice.

Plan completion checks:

- task source is loaded;
- run evidence exists;
- run task id matches the plan task id;
- HARNESS_RESULT is present and passing;
- scope violations are absent;
- declared verify commands are present and passing;
- writer runs have a candidate commit and report-only runs do not;
- Samantha evaluation passed.

Stop condition:

- `overallStatus: "clear"` means the evidence is ready for the next
  Samantha-owned gate.
- Any non-clear status names the first missing, stale, or blocked reason in
  `recommendation`.

## Slice Queue

| Slice | Status | Objective | Depends on | Verification | Next prompt |
| --- | --- | --- | --- | --- | --- |
| S1 | completed | Inspect gstack and identify Samantha-shaped gaps to fill. | none | Report-only gstack code/docs inspection. | n/a |
| S2 | completed | Introduce Initiative Continuity Brief guidance and seed this initiative artifact. | S1 | `git diff --check HEAD -- '*.md' 'references/**/*.md'` passed on 2026-05-15. | n/a |
| S3 | completed | Design Plan Completion Audit plus Review Readiness Report v0. | S2 | Design captured in `Readiness v0 Design`. | n/a |
| S4 | completed | Implement the first deterministic readiness artifact or CLI surface. | S3 | `bun test tests/readiness.test.ts`, `bun test tests/cli.test.ts`, `bun run typecheck`, and `bun test` passed on 2026-05-15. | n/a |
| S5 | completed | Dogfood the continuity flow across a fresh session. | S4 | `bun run samantha readiness:check --initiative=references/initiatives/gstack-inspired-samantha-readiness.md` returned `overallStatus: "clear"` before closure and identified S3 as the next slice; after closure it returns `overallStatus: "clear"` with no current slice. | n/a |

## Current Next Slice

No next slice. This initiative is complete.

## End-of-Session Update Rule

Before ending any session that works on this initiative, update this file with:

- the slice status that changed;
- verification commands and outcomes;
- any accepted or rejected decision changes;
- the next `ready` slice;
- the next-session prompt if another session should continue.

If verification fails, mark the active slice `blocked` and name the recovery
action instead of pretending the next slice is ready.

## Completion Rule

This initiative is complete when Samantha has a dogfooded readiness loop that:

- compares a plan or task spec against completed evidence;
- reports missing, stale, blocked, and clear review/verification states;
- preserves multi-slice context through an Initiative Continuity Brief;
- can be continued in a fresh session without relying on chat history.
