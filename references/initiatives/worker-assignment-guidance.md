# Worker Assignment Guidance

## Goal

Make Samantha worker assignment clearer without turning workers into roleplay
personas. Task specs should carry explicit assignment metadata that improves
worker procedure, later run analysis, and future policy or playbook promotion
without granting extra worker authority.

## Source

- codex / 2026-05-18 Samantha worker assignment guidance brainstorm

## Accepted Decisions

- Do not build a roster of persona-style workers such as architecture worker,
  policy worker, CLI worker, or docs worker.
- Worker specialization should be expressed as task-level assignment metadata,
  not as worker identity or authority.
- Add `taskFamily`, `workMode`, and `riskClass` as first-class `TaskSpec`
  fields.
- Task templates should provide default `taskFamily`, `workMode`, and
  `riskClass` values. BK or the task author only edits them when the default is
  wrong.
- `taskFamily`, `workMode`, and `riskClass` do not grant authority. Authority
  remains controlled by `targetFiles`, `forbiddenChanges`, `verifyCommands`,
  `writerClass`, and policy checks.
- `riskClass` is a single value in the first version. If repeated run evidence
  shows that single-risk classification hides important compound risks, propose
  a reviewed alternative such as risk tags or `riskClass` plus additional
  risk notes.
- The current candidate enum shapes are:
  - `taskFamily`: `cli-command`, `core-module`, `docs-only`, `report-review`,
    `recovery`
  - `workMode`: `minimal-change`, `tdd-first`, `diagnosis-first`
  - `riskClass`: `routine`, `authority-sensitive`, `doctrine-sensitive`,
    `lifecycle-sensitive`

## Non-Goals

- No roleplay persona system.
- No worker-owned orchestration, delegation, merge, push, cleanup, doctrine, or
  policy authority.
- No automatic dispatch based only on inferred assignment metadata in the first
  version.
- No broad worker profile explosion before task-level metadata has run evidence.

## Invariants

- Samantha owns task creation, worktree allocation, dispatch policy,
  verification, final commit, run logs, lifecycle transitions, and cleanup.
- Workers may only do what their task spec and agent profile allow.
- Assignment metadata may change worker procedure and prompt guidance, but it
  must not weaken deterministic verification or scope checks.
- Batch planning must continue to treat contracts, policy, task templates,
  agent profiles, and doctrine documents as serial-only authority-boundary work.
- Learning from worker behavior must happen through reviewed artifacts, not
  hidden memory.

## Slice Queue

| Status | Slice | Objective | Dependency | Verification | Next Prompt |
| --- | --- | --- | --- | --- | --- |
| completed | Brainstorm direction | Decide that assignment metadata, not worker personas, is the core direction. | BK discussion | This brief records accepted decisions. | N/A |
| ready | Contract plan | Plan the smallest implementation slice for first-class `TaskSpec` assignment fields, template defaults, prompt guidance, run-log preservation, and focused tests. | Accepted decisions in this brief | Plan-only review of intended files, policy impact, and test scope. | `sam p: references/initiatives/worker-assignment-guidance.md를 읽고 taskFamily/workMode/riskClass를 TaskSpec 정식 필드로 넣는 최소 구현 계획을 세워줘. 권한은 늘리지 말고 template default, prompt guidance, run-log evidence, batch preflight 영향까지 검토해줘.` |
| pending | Implementation | Add first-class assignment fields through Samantha self-build gates. | Contract plan accepted | SDK-backed worker run, focused tests, typecheck, run evidence. | `sam c: accepted plan에 따라 worker assignment metadata 구현을 Samantha self-build gate로 정규화해줘.` |
| pending | Evidence review | Review early run logs for whether single-value `riskClass` is hiding repeated compound-risk issues. | Several accepted runs using the new fields | Report-only review of run evidence. | `sam r: worker assignment metadata가 적용된 최근 run evidence를 보고 riskClass 단일값 tradeoff가 반복 이슈를 만들었는지 검토해줘.` |

## Current Next Slice

Next slice: `Contract plan`.

The next session should read this brief first, then produce a plan for the
smallest implementation slice. It should not implement directly until the plan
is accepted and the Samantha self-build worker gate is used.

## End-of-Session Update Rule

At the end of each slice, update this brief with completed slice status,
accepted decision changes, verification results, discovered blockers, and the
next ready prompt.

## Completion Rule

Close this initiative when `TaskSpec` has first-class assignment fields,
bundled task templates provide defaults, worker prompts receive procedural
guidance from those fields, run logs preserve the values, focused tests pass,
and at least one report-only evidence review checks whether the `riskClass`
single-value tradeoff should remain.
