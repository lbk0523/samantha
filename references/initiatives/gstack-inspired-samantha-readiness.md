# Initiative: gstack-inspired Samantha readiness loop

Status: active
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

## Slice Queue

| Slice | Status | Objective | Depends on | Verification | Next prompt |
| --- | --- | --- | --- | --- | --- |
| S1 | completed | Inspect gstack and identify Samantha-shaped gaps to fill. | none | Report-only gstack code/docs inspection. | n/a |
| S2 | completed | Introduce Initiative Continuity Brief guidance and seed this initiative artifact. | S1 | `git diff --check HEAD -- '*.md' 'references/**/*.md'` passed on 2026-05-15. | n/a |
| S3 | ready | Design Plan Completion Audit plus Review Readiness Report v0. | S2 | Decision-complete plan with artifact shape, scope, tests, and stop conditions. | See Current Next Slice. |
| S4 | pending | Implement the first deterministic readiness artifact or CLI surface. | S3 | Focused tests plus `bun run typecheck` and `bun test`. | To be written after S3. |
| S5 | pending | Dogfood the continuity flow across a fresh session. | S4 | Fresh session starts from this brief, performs one slice, and updates the brief. | To be written after S4. |

## Current Next Slice

Start S3.

```text
Samantha plan: gstack에서 빌릴 첫 product slice로 Plan Completion Audit + Review Readiness Report v0를 설계해줘. 먼저 /Users/byung/Documents/samantha/references/initiatives/gstack-inspired-samantha-readiness.md 와 /Users/byung/Documents/samantha/references/playbooks/initiative-continuity-brief.md 를 읽어. 아직 코드는 바꾸지 말고, artifact 위치, 입력/출력 schema, Samantha brainstorm/plan/command와의 연결, deterministic verification, task spec으로 승격할 stop condition을 포함한 decision-complete implementation plan을 한국어로 작성해줘.
```

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
