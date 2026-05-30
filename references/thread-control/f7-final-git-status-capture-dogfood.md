# Samantha Thread Control Plane F7 Final Git Status Capture Dogfood

## Purpose

This concise dogfood report records the expected F7 validation point for
deterministic final git status capture after accept cleanup.

F6 implemented deterministic final git status capture after accept cleanup. The
F6 run log is:

`runs/2026-05-30T19-48-24-465Z-samantha-thread-control-plane-f6-final-git-status-capture.json`

F6's own accept did not include `final_git_status_captured` because the accept
process started before the F6 code was merged. Its `visibilitySummary` therefore
still showed `finalGitStatus: not_captured`.

## F7 Dogfood Expectation

The F7 accept starts after F6 is already in `main`. Therefore, after F7 cleanup
and lifecycle work complete, Samantha should append `final_git_status_captured`
to the F7 run log.

`runs:show` should then project `visibilitySummary.finalGitStatus` from that
trusted Samantha run evidence as one of `clean`, `dirty`, or `unavailable`.

The expected source of truth is the F7 Samantha trajectory evidence, not thread
summary text, thread navigation, worker judgment, or an inference from nearby
merge or cleanup status.

## Boundaries

- Thread summary and thread id are advisory navigation only.
- `finalGitStatus` must come from Samantha trajectory evidence.
- This report does not replace accept, merge, cleanup, or lifecycle gates.
- This report does not grant workers orchestration, merge, cleanup, push, or
  lifecycle authority.
- Worker output remains untrusted until Samantha verifies scope, verification,
  run evidence, and lifecycle gates outside the worker's judgment.

## Operator Verification Checklist

After accepting F7, inspect the F7 run log:

- Confirm the run log includes a post-cleanup `final_git_status_captured`
  trajectory event.
- Confirm the event records the captured final git status as clean, dirty, or
  unavailable.
- Confirm the event appears after cleanup and lifecycle evidence, not during
  worker verification.
- Confirm no worker-authored report is being used as the trusted final git
  status source.

Then inspect `runs:show` for the F7 run:

- Confirm `visibilitySummary.finalGitStatus` is no longer `not_captured` when
  trusted final git status evidence exists.
- Confirm the projected value matches the F7 run-log evidence.
- Confirm `threadNavigation` remains advisory and does not prove final git
  status.
- Confirm accept, merge, cleanup, lifecycle, scope, and verification gates are
  still evaluated independently.
