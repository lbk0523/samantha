# Samantha Thread Control Plane Manual Linkage Dogfood Report

## Purpose

This report dogfoods manual advisory linkage for Samantha Thread Control Plane
Slice D using existing Slice A, Slice B, and Slice C run evidence only.

Manual linkage is advisory evidence navigation only. It did not decide accept,
merge, cleanup, lifecycle, or success. thread summary is advisory only.
trusted evidence remains Samantha run evidence.
worker-owned orchestration remains forbidden.

The linkage can point an operator to run evidence faster, but it must not replace accept, merge, cleanup, or lifecycle gates.

## Source Evidence

The source evidence is limited to these existing run logs:

- `runs/2026-05-30T10-51-44-993Z-samantha-thread-control-plane-slice-a.json`
- `runs/2026-05-30T11-12-10-431Z-samantha-thread-control-plane-slice-b.json`
- `runs/2026-05-30T12-14-21-943Z-samantha-thread-control-plane-slice-c.json`

Each log includes `result.runtime.threadId`, `result.evaluation`,
`result.commit`, and `trajectory` lifecycle evidence for merge and cleanup.
No additional background Codex thread or dogfood worker was started for this
report.

## Manual Linkage Records

### Slice A

- Run id:
  `2026-05-30T10-51-44-993Z-samantha-thread-control-plane-slice-a`
- Background thread id: `019e7882-eada-7432-99a6-684d65565f0f`
- Run log path:
  `runs/2026-05-30T10-51-44-993Z-samantha-thread-control-plane-slice-a.json`
- `HARNESS_RESULT` status: `pass`
- Top-level run-task pass: `true`
- Changed-file scope:
  `references/thread-control/samantha-thread-control-plane.md`
- Scope violations: none
- Verification summary: 6 declared verification commands passed, 0 failed.
- Candidate commit: `0f1a518104aed1ed5969eaee9a3a3863ef31069f`
  (`docs: add thread control plane brief`)
- Merge / cleanup lifecycle summary: `merge_checked` completed with
  `mergeStatus: mergeable`, `mayMerge: true`, `violationCount: 0`, and
  `alreadyMerged: false`; `merge_finished` completed with `exitCode: 0`;
  lifecycle was marked `merged` at `2026-05-30T10:53:45.837Z`;
  `cleanup_finished` completed with `classification: completed`,
  `mayCleanup: true`, and `cleaned: true`; lifecycle was marked `cleaned` at
  `2026-05-30T10:53:46.011Z`.
- Final git status interpretation: the log proves merge and cleanup lifecycle
  completion for the candidate commit. It does not include a separate
  top-level final `git status` command, so final cleanliness is tracked
  indirectly through lifecycle evidence rather than a direct status snapshot.

### Slice B

- Run id:
  `2026-05-30T11-12-10-431Z-samantha-thread-control-plane-slice-b`
- Background thread id: `019e7895-9d87-77e0-bc60-7e1c84d378fa`
- Run log path:
  `runs/2026-05-30T11-12-10-431Z-samantha-thread-control-plane-slice-b.json`
- `HARNESS_RESULT` status: `pass`
- Top-level run-task pass: `true`
- Changed-file scope: `references/thread-control/operator-playbook.md`
- Scope violations: none
- Verification summary: 8 declared verification commands passed, 0 failed.
- Candidate commit: `a3d31a64ff93d8f4b23bc91bd1b1f6be28151009`
  (`docs: add thread control operator playbook`)
- Merge / cleanup lifecycle summary: `merge_checked` completed with
  `mergeStatus: mergeable`, `mayMerge: true`, `violationCount: 0`, and
  `alreadyMerged: false`; `merge_finished` completed with `exitCode: 0`;
  lifecycle was marked `merged` at `2026-05-30T11:14:14.587Z`;
  `cleanup_finished` completed with `classification: completed`,
  `mayCleanup: true`, and `cleaned: true`; lifecycle was marked `cleaned` at
  `2026-05-30T11:14:14.747Z`.
- Final git status interpretation: worker advisory evidence listed
  `git status --short`, but the top-level harness verification did not include
  a final post-cleanup status command. The trusted lifecycle state still shows
  the candidate commit was fast-forward merged and the worker worktree was
  cleaned.

### Slice C

- Run id:
  `2026-05-30T12-14-21-943Z-samantha-thread-control-plane-slice-c`
- Background thread id: `019e78ce-8d27-7cb3-bf64-efcdc76d336a`
- Run log path:
  `runs/2026-05-30T12-14-21-943Z-samantha-thread-control-plane-slice-c.json`
- `HARNESS_RESULT` status: `pass`
- Top-level run-task pass: `true`
- Changed-file scope:
  `references/thread-control/linkage-artifact-design.md`
- Scope violations: none
- Verification summary: 9 declared verification commands passed, 0 failed.
- Candidate commit: `f58015a18f47fbf286a4079303fdbf022ec3b3d4`
  (`docs: add thread control linkage design`)
- Merge / cleanup lifecycle summary: `merge_checked` completed with
  `mergeStatus: mergeable`, `mayMerge: true`, `violationCount: 0`, and
  `alreadyMerged: false`; `merge_finished` completed with `exitCode: 0`;
  lifecycle was marked `merged` at `2026-05-30T12:16:16.876Z`;
  `cleanup_finished` completed with `classification: completed`,
  `mayCleanup: true`, and `cleaned: true`; lifecycle was marked `cleaned` at
  `2026-05-30T12:16:17.059Z`.
- Final git status interpretation: worker advisory evidence listed
  `git status --short -- references/thread-control/linkage-artifact-design.md
  references/thread-control`, but the trusted run log lifecycle evidence is
  merge plus cleanup. A direct top-level final status snapshot is not present.

## Dogfood Findings

- Linkage reduced navigation friction by putting run id, background thread id,
  run log path, candidate commit, scope, verification, and lifecycle events in
  one review surface. Without linkage, the operator has to inspect `result`,
  `result.evaluation`, `result.commit`, and `trajectory` separately.
- Pass/fail could be decided without thread summary for all three slices:
  `HARNESS_RESULT` status, top-level run-task pass, scope violations,
  verification results, candidate commit, merge lifecycle, and cleanup
  lifecycle were sufficient.
- Missing candidate commit or already-applied `TaskSpec` cases would remain
  visible if the linkage always names both `HARNESS_RESULT` status and
  top-level run-task pass plus candidate commit. These three runs all had
  candidate commits, so this report does not prove the failure case directly.
- `runs:accept` prerequisites are visible when the linkage records top-level
  pass, candidate commit, scope violations, verification failures, merge
  eligibility, and lifecycle state. The linkage still must not decide
  acceptance.
- Lifecycle completion can be tracked from `trajectory` events. Final git
  status tracking is weaker: the logs show merge and cleanup lifecycle, and
  Slice B/C worker advisory checks mention `git status`, but there is no
  uniform top-level final post-cleanup `git status` snapshot across Slice A/B/C.

## Gate Preservation

The manual linkage preserved Samantha gates by treating the thread id and
summary as navigation aids only. It did not create trusted state, lifecycle
state, accept decisions, merge authority, cleanup authority, or success
classification.

All success judgments remain tied to Samantha run evidence: run log,
`HARNESS_RESULT`, changed-file scope, deterministic verification, candidate
commit, and lifecycle record.

## Friction

- The run logs contain enough evidence, but useful fields are spread across
  `result.runtime`, `result.evaluation`, `result.commit`, and `trajectory`.
- `result.evaluation.harness.commit` was an empty string in the inspected logs;
  the candidate commit was instead available at `result.commit.commitHash` and
  in lifecycle details.
- Final git status is not captured uniformly as top-level lifecycle evidence.
  Operators must not infer more than merge and cleanup lifecycle actually
  prove.
- Worker advisory `git status` checks, when present, are useful for navigation
  but should not be promoted above Samantha-owned verification and lifecycle
  evidence.

## Slice E Implications

- Slice E should prioritize run progress visibility that surfaces `threadId`,
  run id, run log path, `HARNESS_RESULT`, top-level pass, changed-file scope,
  verification result, candidate commit, and lifecycle event state together.
- Slice E should show candidate commit from `result.commit.commitHash` and not
  rely on `result.evaluation.harness.commit`.
- Slice E should distinguish advisory worker notes from trusted harness
  evidence.
- Slice E should make missing candidate commit, failed top-level pass, scope
  violations, failed verification, incomplete merge, incomplete cleanup, and
  missing final status evidence visible as separate states.
- Slice E should keep final status visibility as evidence navigation unless a
  reviewed implementation slice adds deterministic capture.

## Non-Goals

This report explicitly excludes implementation code, JSON schema, CLI changes,
run-log implementation, thread API automation, background scheduler, daemon,
UI, MCP, connector integration, operation artifacts, lesson artifacts, task
specs, source code, tests, and edits to Slice A/B/C documents.

It also excludes creating new background threads, dogfood workers, hidden
memory, accepted lifecycle state, merge or cleanup actions, policy changes,
doctrine changes, and any new product surface.

## Stop Conditions

Stop using manual linkage as evidence if a run log lacks
`result.runtime.threadId`, `HARNESS_RESULT`, top-level pass/fail, changed-file
scope, verification results, candidate commit evidence, or lifecycle evidence.

Stop if thread summary, thread id, worker notes, or this report are treated as
trusted success evidence.

Stop before Slice E implementation if the next work would add schema, CLI,
run-log fields, thread API automation, background operation, UI, MCP,
connector integration, operation artifacts, lesson artifacts, task specs,
source code, tests, or lifecycle authority without an explicit reviewed task
spec.
