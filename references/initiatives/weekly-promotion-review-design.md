# Initiative: Weekly Promotion Review

Status: decisions recorded
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
- The review cadence is every Saturday at 00:00 Asia/Seoul.
- The source-of-truth output is a repository artifact, not a thread report,
  because Samantha learning and audit evidence must be reviewable repository
  artifacts.
- A thread report may exist only as an optional derived notification from the
  repository artifact.
- If the inbox or promotion queue is empty, the review should stop without
  creating a weekly report.

## Non-Goals

- No daemon, watch process, App Server, remote adapter, or background scheduler
  in this slice.
- No automatic playbook, policy, task template, or agent profile edits.
- No automatic promotion.
- No worker, runtime, verification, scope, commit, cleanup, or lifecycle
  authority changes.

## Decision Points Before Implementation

- What exact repository artifact path and schema should represent the weekly
  report?
- What future reviewed authority artifact, if any, should represent the routine
  trigger and audit trail?
- What optional thread notification metadata should derive from the repository
  artifact, if notification is added?

## Candidate Report Shape

```text
weekly promotion review
-> read references/lessons/reviews/index.json or run lessons:promotion-queue
-> stop without creating a weekly report if the inbox or promotion queue is empty
-> group queue by promote_candidate, manual_review, needs_more_evidence, reject_candidate
-> write a repository artifact with counts and top candidate paths
-> optionally derive a thread notification from that repository artifact
-> stop before promotion or repository mutation beyond the weekly report artifact
```

## Verification For Future Slice

- Focused tests for the report formatter and empty queue.
- CLI or automation tests proving report-only behavior.
- `git diff --check`.

## Stop Conditions

Stop and keep this as design-only if implementation requires daemon/watch,
remote adapter, hidden memory, automatic promotion, automatic playbook/policy
edits, or lifecycle authority changes.
