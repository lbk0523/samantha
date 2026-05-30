# Samantha Thread Control Plane Run Progress Visibility Design

## Purpose

This document defines a visibility-only design for showing Samantha Thread
Control Plane run progress to an operator. It does not grant authority to the
thread summary, worker notes, or any new surface. thread summary is advisory only.
trusted evidence remains Samantha run evidence.
worker-owned orchestration remains forbidden.
This design must not replace accept, merge, cleanup, or lifecycle gates.

## Slice D Evidence

Slice D found that useful run progress evidence exists, but it is spread across
`result.runtime`, `result.evaluation`, `result.commit`, and `trajectory`.
Operators can already decide review direction from Samantha run evidence when
they inspect the run log, `HARNESS_RESULT`, top-level pass/fail, changed-file
scope, deterministic verification, candidate commit, merge lifecycle, and
cleanup lifecycle.

Slice D also found that the candidate commit must come from
`result.commit.commitHash` rather than `result.evaluation.harness.commit`.
The inspected logs did not uniformly capture final git status as a top-level
post-cleanup snapshot, so final git status must remain visible as missing or
candidate evidence unless a later slice explicitly designs and verifies that
requirement.

## Visibility Boundary

The visibility surface may help an operator find evidence faster. It may group
run id, thread id, run log path, pass/fail state, changed-file scope,
verification, candidate commit, and lifecycle progress in one review surface.

The visibility surface must not create trusted state, perform accept, merge, or
cleanup, infer lifecycle completion, create background work, call thread APIs,
or promote worker advisory checks above Samantha-owned evidence. A displayed
state is only a navigation aid until Samantha verifies the underlying run
evidence and lifecycle gates.

## Evidence Source Map

- `result.runtime.threadId`: advisory navigation handle for the background
  thread associated with a run.
- `result.evaluation.harness.status`: parsed harness status, including
  `HARNESS_RESULT` success, rework, or blocked classification.
- `result.pass`: top-level run-task pass/fail outcome.
- `result.evaluation.changedFiles`: changed-file scope evidence for target
  file review.
- `result.evaluation.scopeViolations`: scope violation evidence that must stay
  distinct from pass/fail and verification state.
- `result.evaluation.verifyResults`: deterministic verification command
  evidence.
- `result.commit.commitHash`: candidate commit evidence when a run reaches a
  commit-producing state.
- `trajectory`: lifecycle evidence for merge check, merge completion, cleanup
  completion, and related Samantha-owned transitions.

## Operator Progress States

- Worker running: no final `HARNESS_RESULT` has been parsed yet.
- HARNESS_RESULT parsed: `result.evaluation.harness.status` is available for
  review.
- Top-level pass false: `result.pass` is false regardless of other advisory
  notes.
- Missing candidate commit: no usable `result.commit.commitHash` is available.
- Scope violation: `result.evaluation.scopeViolations` is non-empty.
- Verification failed: `result.evaluation.verifyResults` includes a failed
  command.
- Candidate commit ready: `result.commit.commitHash` is present and the run is
  otherwise eligible for Samantha-owned review.
- Merge checked: `trajectory` shows merge check evidence, without implying
  merge completion.
- Merge completed: `trajectory` shows merge completion evidence.
- Cleanup completed: `trajectory` shows cleanup completion evidence.
- Final git status not captured: final git status is not present as uniform
  top-level evidence and must be shown as unavailable rather than inferred.

## Final Git Status Visibility

Final git status should be treated as a candidate requirement for a later
slice, not as an implementation change in this design. Slice E does not add a
run-log field, schema, CLI command, source code path, or lifecycle transition
for final git status.

Until a later reviewed design defines how final git status is captured and
verified, the progress view should show whether final git status evidence is
present, missing, or advisory-only. It must not infer clean state from merge or
cleanup lifecycle events beyond what those events actually prove.

## Slice F Decisions

- Visibility surface location: decide where an operator should see run progress
  without creating an unscoped product surface.
- Final git status handling: decide whether final git status should become
  required evidence and where it would be captured.
- Thread id handling: decide how `result.runtime.threadId` is displayed as
  advisory navigation without becoming trusted state.
- Failed/rework/blocked run state display: decide how to present these states
  without hiding scope, verification, commit, or lifecycle evidence.
- Report-only review before code: decide whether Slice F needs a report-only
  review before any implementation task is authorized.

## Non-Goals

- No implementation code, JSON schema, CLI design, run-log field
  implementation, thread API automation, scheduler, daemon, UI, MCP,
  connector integration, source code, tests, task specs, operation artifacts,
  lessons, or edits to Slice A/B/C/D documents.
- No accept, merge, cleanup, lifecycle, orchestration, worker allocation,
  worker dispatch, commit, push, or policy authority.
- No background operation, multi-project orchestration, budget governance, or
  operator UI behavior beyond visibility design language.

## Stop Conditions

Stop before implementation if the next step would require code, schema, CLI,
run-log field, thread API, scheduler, daemon, UI, MCP, connector, test,
operation artifact, lesson, task spec, or lifecycle authority changes.

Stop using this visibility design as evidence if an operator treats the thread
summary, worker notes, thread id, or grouped progress display as trusted
success evidence. Samantha-owned run evidence and lifecycle gates remain the
source of truth.
