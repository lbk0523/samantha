# Learning Trigger Policy

Status: active
Source: Samantha self-build learning UX slice, 2026-05-16

## Purpose

Reduce the chance that BK must remember `sam l` after every useful run, without
adding hidden memory or automatic promotion.

## Automatic Candidate Trigger

`runs:accept` may create a lesson candidate only after all of these gates pass:

- The run is a writer run, not report-only.
- The run passed Samantha evaluation and produced a candidate commit.
- Samantha accepted the run and recorded cleaned lifecycle evidence.
- The run has high-signal same-family evidence in the run index.

High-signal same-family evidence is limited to:

- a prior `verify_failed` run followed by the accepted writer run
- a prior `scope_failed` run followed by the accepted writer run
- a prior `blocked` or `rework` run followed by the accepted writer run
- repeated prior failures in the same task family followed by the accepted writer
  run
- an explicit brainstorm decision, represented manually through the normal
  `lessons:draft` flow until a reviewed artifact contract exists

## Artifact Boundary

Automatic drafting may write only:

- `references/lessons/inbox/<runId>.md`

It must not write promoted playbooks, policies, task templates, agent profiles,
or hidden memory. Existing inbox candidates must not be overwritten.

## Review Boundary

Automatic drafting does not review or promote. Promotion requires the explicit
review flow:

```text
lesson candidate
-> lessons:review or lessons:review-inbox
-> promotion queue report
-> explicit lessons:promote when justified
```

## Non-Goals

- No daemon, watch, routine trigger, App Server, or remote adapter.
- No automatic playbook, policy, task template, or agent profile edits.
- No worker, runtime, verification, scope, commit, cleanup, or lifecycle
  authority changes.
