# Samantha Learning Architecture Brainstorm

Last updated: 2026-05-13

## Goal

Samantha should become better at working with BK through repeated software work.

The hard requirement is that learning must be explicit, reviewable, and
reversible. Samantha should not rely on hidden memory or vague preference drift.

## Core Idea

Learning is a pipeline:

```text
run evidence
-> lesson candidate
-> review
-> promoted artifact
-> enforcement or guidance
-> later run evidence
```

Nothing becomes a durable rule until it is promoted into a repository artifact.

## Learning Inputs

Useful learning inputs:

- repeated run failures
- repeated scope violations
- repeated verify command fixes
- repeated task decomposition patterns
- repeated user corrections
- repeated merge/cleanup blockers
- tasks that completed unusually smoothly
- tasks that needed extra clarification

Bad learning inputs:

- one-off annoyance
- unverified worker claims
- hidden chat memory
- broad style preferences that cannot be enforced
- lessons that weaken safety boundaries

## Artifact Types

### Lesson Candidates

Possible path:

```text
references/lessons/inbox/*.md
```

Purpose:

- capture a proposed lesson from a run
- link to run id, task id, changed files, and evidence
- state whether it should become a policy, playbook, template, or profile change

Candidate fields:

- source run id
- observed problem or success
- proposed lesson
- affected layer
- suggested artifact change
- risk if adopted
- expiry/review note

### Playbooks

Possible path:

```text
references/playbooks/*.md
```

Purpose:

- guide repeated development workflows
- remain advisory unless referenced by task/profile/policy

Examples:

- TypeScript library change playbook
- CLI command addition playbook
- worker verification failure playbook
- docs-only direction-setting playbook

### Task Templates

Possible path:

```text
references/task-templates/*.json
```

Purpose:

- make repeated task shapes cheap and consistent
- prefill target files, forbidden changes, setup, and verify conventions

Examples:

- docs-only direction update
- core module plus focused tests
- CLI command plus parser tests
- cleanup/lifecycle command

### Agent Profile Revisions

Existing path:

```text
references/agent-profiles/*.json
```

Purpose:

- tune worker contracts
- add report-only specialists later
- keep writer authority scarce

Rule:

Agent profiles may guide worker behavior, but they cannot grant authority that
policy rejects.

### Policy Changes

Existing path:

```text
src/core/policy.ts
tests/policy.test.ts
```

Purpose:

- turn recurring safety lessons into enforceable gates

Rule:

Every policy lesson needs a test. If the lesson cannot be tested, it should
start as a playbook, not policy.

## Promotion Flow

Recommended flow:

1. Samantha detects a pattern from run evidence or BK feedback.
2. Samantha writes a lesson candidate.
3. BK reviews the candidate.
4. Candidate is promoted to one of:
   - playbook
   - task template
   - agent profile change
   - policy/test change
   - architecture/north-star documentation
5. Future task planning reads the promoted artifact.
6. Later run summaries prove whether the lesson helped.

## Enforcement Levels

Not every lesson deserves the same force.

### Advisory

Stored in playbooks. Useful for planning and prompting, but not a hard gate.

### Default

Stored in templates or profiles. Used automatically unless a task overrides it.

### Gate

Stored in TypeScript policy and tests. Blocks dispatch, evaluation, merge, or
cleanup.

### Doctrine

Stored in `NORTH_STAR.md`, `ARCHITECTURE.md`, or `AGENTS.md`. Shapes product
direction and should change rarely.

## CEO Learning Loop

The CEO layer should learn at the planning level:

- how BK prefers work scoped
- when BK wants direct action instead of broad options
- which verification commands are credible
- which changes deserve separate tasks
- which repeated failures need new policy

This learning should appear as:

- better task decomposition
- fewer unnecessary questions
- sharper status reports
- better defaults
- stronger tests

It should not appear as:

- hidden assumptions
- unreviewed memory
- autonomous expansion of scope
- weakened safety gates

## Worker Learning Loop

Workers do not learn directly. Their behavior changes only when Samantha updates
artifacts that workers receive:

- task instructions
- agent profile
- blocked skills
- target files
- forbidden changes
- verify commands
- playbook references

This keeps responsibility clear. A worker cannot claim it learned a new
authority boundary.

## Implemented Learning Loop Slice

The current implemented learning loop is:

```text
bun run samantha lessons:draft --run-log=<path>
bun run samantha lessons:review <candidate.md>
bun run samantha lessons:review-inbox [--repo-root=<repo>]
bun run samantha lessons:promote <candidate.md> --playbook-id=<id>
bun run samantha lessons:record-evidence <playbook.md> --run-log=<path> --assessment=helped|not-helped|unclear --note=<note>
```

It does:

- read one run log
- summarize failures, scope violations, verify failures, cleanup blockers, and
  commit outcome
- write a markdown lesson candidate under `references/lessons/inbox/`
- include lifecycle, superseded-run, and task-family recurrence evidence
- review candidates into JSON artifacts under `references/lessons/reviews/`
- batch-review the inbox and write a review index
- keep stale or no-promotion candidates auto-rejected
- keep one-off playbook candidates as needs-more-evidence
- mark recurring playbook candidates as promotion candidates once they reach the
  recurrence threshold
- promote explicit playbook candidates only through `lessons:promote`
- append later run evidence to promoted playbooks through
  `lessons:record-evidence`

Current status:

- lesson drafting and review are deterministic and make no LLM call
- lifecycle state is included when `run-lifecycle.jsonl` exists beside the run
  log
- promoted artifacts are not modified by draft or review commands
- promotion remains a separate explicit command

## Task Template Slice

The first template artifacts are now present:

```text
references/task-templates/docs-only.json
references/task-templates/core-module-with-tests.json
references/task-templates/cli-command-with-tests.json
references/task-templates/report-only-review.json
```

The current generator is:

```text
bun run samantha tasks:from-template <template-id> --task-id=<id> --title=<title> [--set=<placeholder>:<value>]...
```

It copies the template's task spec into `references/tasks/<task-id>.json` and
replaces `id`, `title`, and any explicitly supplied placeholders. Other
placeholders, such as `<module>`, remain visible for manual narrowing before
dispatch, and the command reports the unresolved placeholder names.

## Report-Only Reviewer Slice

The first non-writer reviewer profile is now present:

```text
references/agent-profiles/codex-reviewer.json
references/tasks/fixture-report-reviewer.json
references/task-templates/report-only-review.json
```

The reviewer is report-only: it uses `writerClass: "non-writer"`,
`worktreePolicy: "none"`, `mergePolicy: "none"`, and task specs with
`resultMode: "report"`. Non-writer report tasks may not declare setup or verify
commands. The reviewer may inspect evidence and produce findings, but it must
not edit files, create commits, merge, clean up worktrees, or change policy.

## Manual Promotion And Later Evidence

Promotion is implemented but deliberately narrow. `lessons:promote` only writes
a playbook when the candidate is a playbook promotion candidate. Inbox review
does not auto-promote durable guidance.

The current automatic promotion-candidate signal is repeated same-family
evidence that reaches the recurrence threshold. Clear high-cost failures can
still be reviewed manually, but they are not an automatic promotion path until
there is a reviewed deterministic signal for them.

## Open Design Questions

- Should lesson candidates be generated only on failed runs, or also on smooth
  successful runs?
- How should promotion candidates be ranked for BK review once the inbox grows?
- Should task templates stay plain JSON after the current first three examples,
  or move to a richer format once real usage exposes friction?
- Should playbooks be referenced explicitly in task specs, or selected by the
  CEO layer during planning?
- How should stale lessons expire when the repo architecture changes?

## Guardrails

Learning must never:

- create background execution
- grant worker merge/push/cleanup authority
- bypass deterministic verification
- store secrets
- hide user preferences in opaque memory
- silently rewrite `AGENTS.md`, `NORTH_STAR.md`, or policy

The right bias is slow promotion and strong evidence.
