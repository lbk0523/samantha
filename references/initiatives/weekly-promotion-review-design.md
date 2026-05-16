# Initiative: Weekly Promotion Review

Status: proposed
Source: Samantha self-build learning UX slice, 2026-05-16

## Goal

Define a safe routine review shape for lesson promotion debt without implementing
routine trigger behavior in this slice.

## Accepted Decisions

- Weekly promotion review is a routine trigger surface and needs a separate
  reviewed product slice before implementation.
- The first acceptable runtime shape is report-only.
- The report may summarize `lessons:promotion-queue` output and recommend
  explicit manual promotion candidates.
- Promotion remains explicit and manual through `lessons:promote`.

## Non-Goals

- No daemon, watch process, App Server, remote adapter, or background scheduler
  in this slice.
- No automatic playbook, policy, task template, or agent profile edits.
- No automatic promotion.
- No worker, runtime, verification, scope, commit, cleanup, or lifecycle
  authority changes.

## Decision Points Before Implementation

- Should the weekly report be written as a repo artifact, posted as a thread
  report, or both?
- What review cadence and owner should the report use?
- Should the report run only when inbox candidates exist, or also when the queue
  is empty as a heartbeat?
- What exact artifact should represent the scheduler authority and audit trail?

## Candidate Report Shape

```text
weekly promotion review
-> read references/lessons/reviews/index.json or run lessons:promotion-queue
-> group queue by promote_candidate, manual_review, needs_more_evidence, reject_candidate
-> report counts and top candidate paths
-> stop before promotion or artifact mutation
```

## Verification For Future Slice

- Focused tests for the report formatter and empty queue.
- CLI or automation tests proving report-only behavior.
- `git diff --check`.

## Stop Conditions

Stop and keep this as design-only if implementation requires daemon/watch,
remote adapter, hidden memory, automatic promotion, automatic playbook/policy
edits, or lifecycle authority changes.
