# Initiative Continuity Brief Playbook

Last updated: 2026-05-15

## Purpose

Use an Initiative Continuity Brief when a Samantha brainstorm or plan produces
multiple follow-up slices that must survive context resets or separate Codex
sessions.

The brief is the durable parent artifact for the work. It prevents slice-level
task specs, handoff prompts, or chat transcripts from becoming the only source
of truth.

## When To Create One

Create or update an Initiative Continuity Brief when all of these are true:

- the work spans more than one implementation or planning slice;
- later slices depend on decisions made in the current session;
- a fresh Codex session would be likely to miss the broader objective from a
  single task spec or handoff prompt;
- BK explicitly approves preserving the plan as a repo artifact.

Do not create one for a single small follow-up, a finished report-only review,
or ordinary daily task tracking.

## Location

Store initiative briefs under:

```text
references/initiatives/<slug>.md
```

Use lowercase slugs with letters, numbers, and dashes.

## Required Sections

Each brief must include:

- `Goal`: the durable outcome the whole initiative is trying to reach.
- `Source`: the session, prompt, report, or external reference that started the
  initiative.
- `Accepted Decisions`: decisions later sessions should not reopen casually.
- `Non-Goals`: tempting work that is explicitly out of scope.
- `Invariants`: Samantha rules that the initiative must not weaken.
- `Slice Queue`: ordered slices with status, objective, dependency, verification,
  and next prompt.
- `Current Next Slice`: the one slice a fresh session should start with.
- `End-of-Session Update Rule`: what each session must update before stopping.
- `Completion Rule`: the observable condition for closing the initiative.

## Status Vocabulary

Use only these slice statuses:

- `completed`: done and verified or deliberately report-only complete.
- `active`: the current session is working on it.
- `ready`: next executable or plannable slice.
- `pending`: blocked by an earlier slice.
- `blocked`: cannot proceed without a named BK decision, external authority, or
  failed verification recovery.
- `dropped`: explicitly removed from the initiative.

At most one slice should be `active`. If no session is working, exactly one
slice should usually be `ready`.

## Operating Rules

- The brief is not hidden memory. It is a reviewable repo artifact.
- The brief does not replace task specs, run logs, lifecycle records, or
  deterministic verification.
- The brief must not grant worker authority, merge authority, deploy authority,
  or cleanup authority.
- The brief must not store secrets, credentials, private tokens, or external
  account state.
- Each slice should be large enough for a useful session and small enough to
  verify independently.
- Next prompts should tell the next session what to read first, what to do, how
  to verify, and when to stop.

## Brainstorm Integration

When a `Samantha brainstorm:` result naturally decomposes into multiple slices,
ask BK whether to create an Initiative Continuity Brief. If BK agrees, the next
`Samantha plan:` or `Samantha command:` should create or update the brief before
generating individual task specs.

The Brainstorm Brief should name the proposed initiative slug and the first
slice. It should not create task specs or dispatch workers by default.

## Session Handoff Integration

When an active Initiative Continuity Brief exists, a next-session prompt should
tell the next session to read it first. The prompt should include only the
current next slice, not the full historical chat context.

At the end of each slice, update the brief with:

- completed slice status;
- changed accepted decisions;
- verification result;
- newly discovered blockers;
- the next `ready` slice and its prompt.

## Markdown Checks

For docs-only updates to initiative briefs or this playbook, run:

```bash
git diff --check HEAD -- '*.md' 'references/**/*.md'
```
