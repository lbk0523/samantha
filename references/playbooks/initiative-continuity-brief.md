# Initiative Continuity Brief Playbook

Last updated: 2026-05-21

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

## Roadmap Closure Discipline

When a long-running initiative keeps discovering adjacent follow-up slices, fix
the remaining roadmap to a named range instead of letting the slice queue grow
indefinitely. The fixed range should name the remaining slices, their order,
and the authority boundary that must not be crossed inside the current
initiative.

Separate the proof slice from the closure slice when the final capability is
risky or authority-bearing. The proof slice should demonstrate the completion
candidate through evidence. The closure slice should decide whether that
evidence completes the initiative or whether remaining authority belongs in a
separate reviewed initiative.

When the closure decision is to stop, say so explicitly in the brief:

- mark the initiative status as completed;
- replace the current next slice with a no-current-next-slice statement;
- state that no S25 or equivalent continuation slice is being added;
- move adjacent authority such as broader routine use, multi-writer execution,
  or batch execution into a separate follow-up initiative boundary.

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
- verification evidence;
- changed accepted decisions;
- newly discovered blockers;
- the next `ready` slice and its prompt when one exists;
- or a clear `no-current-next-slice`, closure decision, or recovery-needed
  state.

Completed slice prompts become historical handoff prompts. Do not reuse a
historical handoff prompt as the current prompt after its slice is completed,
failed, dropped, or superseded.

The `Current Next Slice` section must name exactly one current slice when one is
ready. If no slice is ready, it must say why: `no-current-next-slice`, closure
decision, recovery-needed, or adjacent initiative needed.

The `End-of-Session Update Rule` must require each completed slice to record:

- final status;
- trusted verification evidence or the reason verification is unavailable;
- new blockers or authority questions;
- next-slice state;
- the current prompt when a next slice exists.

This brief does not replace task specs, run logs, lifecycle records, or
deterministic verification, and it grants no worker, merge, cleanup, commit,
push, or lifecycle authority.

## Branch-Specific Handoff Examples

Use one copy-paste-ready fenced prompt when recommending a next prompt. Preserve
the slot order when slots are present.

Next slice ready:

```text
sam c: execute the next ready slice from <initiative-slug>
Context:
Ask:
Scope:
Output:
Stop:
```

Execution boundary incomplete:

```text
sam p: plan the next slice boundary for <initiative-slug>
Context:
Ask:
Scope:
Output:
Stop:
```

Product or authority decision needed:

```text
sam b: decide the product or authority boundary for <initiative-slug>
Context:
Ask:
Scope:
Output:
Stop:
```

Failed or untrusted completion:

```text
sam re: recover the failed or untrusted slice in <initiative-slug>
Context:
Ask:
Scope:
Output:
Stop:
```

Completion rule satisfied:

```text
No next action recommended: the completion rule is satisfied and the brief has
no-current-next-slice.
```

Adjacent initiative needed:

```text
sam b: define a separate initiative boundary for <adjacent-surface>
Context:
Ask:
Scope:
Output:
Stop:
```

## Markdown Checks

For docs-only updates to initiative briefs or this playbook, run:

```bash
git diff --check HEAD -- '*.md' 'references/**/*.md'
```
