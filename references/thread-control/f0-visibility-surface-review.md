# Samantha Thread Control Plane F0 Visibility Surface Review

## Purpose

This report reviews the smallest safe F1 visibility surface for Samantha Thread
Control Plane run progress. It is docs-only and does not authorize
implementation, lifecycle changes, CLI behavior, run-log shape changes, thread
API automation, scheduler behavior, daemon behavior, UI, MCP, connector
integration, task specs, operation artifacts, or source code changes.

The visibility surface may help an operator inspect existing Samantha run
evidence faster. It must keep the boundary explicit:

- thread summary is advisory only
- trusted evidence remains Samantha run evidence
- worker-owned orchestration remains forbidden
- must not replace accept, merge, cleanup, or lifecycle gates

## Decision Context

Slice E identified useful visibility evidence already present in existing run
logs, but spread across `result.runtime`, `result.evaluation`, `result.commit`,
and `trajectory`. F0 should decide which F1 implementation surface can project
that evidence without adding product authority.

The next implementation should read only existing run log shape and project
visibility fields from:

- `result.runtime.threadId`
- `result.evaluation.harness.status`
- `result.pass`
- `result.evaluation.changedFiles`
- `result.evaluation.scopeViolations`
- `result.evaluation.verifyResults`
- `result.commit.commitHash`
- `trajectory`

`threadId` is advisory navigation only. It may help an operator find related
thread context, but it does not prove completion, acceptance, lifecycle state,
or clean repository state.

## Candidate Surfaces

### Existing `runs:show` Additive Summary

Adding a summary to an existing run-inspection command would put visibility in
a familiar operator path. It also risks turning a convenience view into a
product surface before the projection contract is tested. Even an additive
summary can blur whether the command owns evidence interpretation, final git
status, lifecycle status, or future thread-control behavior.

This option is useful later, but it is too close to CLI authority for F1.

### Separate Report-Only Command

A separate report-only command would make the visibility surface explicit and
avoid modifying existing command output. It still introduces a new operator
entrypoint and therefore raises questions about naming, lifecycle expectations,
output compatibility, and whether the command becomes a trusted review step.

This option is clearer than modifying `runs:show`, but it is still larger than
the smallest testable F1 surface.

### Core Read-Only Projection Helper

A core read-only projection helper is the recommended F1 surface. It can accept
existing run evidence, project a small visibility object, and be tested with
fixtures for pass, failed, rework, blocked, scope violation, verification
failure, missing candidate commit, merge state, cleanup state, and missing final
git status.

This is the smallest testable implementation surface and avoids immediate CLI,
run-log, lifecycle, or thread API authority changes. It also keeps the later
choice open for whether a CLI command, report-only output, or operator playbook
uses the projection.

### Docs-Only Checklist

A docs-only checklist is safest from an authority perspective, but it does not
create deterministic behavior. It would keep the same manual inspection burden
that Slice E identified and would not prove that the projection can separate
failed, rework, blocked, scope, verification, commit, merge, cleanup, and final
git status states.

This option is useful as guidance, but it is not enough for F1 if the goal is a
testable visibility surface.

## Recommended F1 Surface

F1 should implement a core read-only projection helper and nothing broader.
The helper should read only existing run log shape and return an advisory
summary of visibility fields. It should not mutate files, dispatch workers,
call thread APIs, create lifecycle records, infer acceptance, run merge or
cleanup checks, create commits, or alter CLI output unless a later reviewed
slice explicitly authorizes that exposure.

The projected object should preserve separate fields for `threadId`,
`harnessStatus`, `topLevelPass`, `candidateCommitStatus`, `scopeStatus`,
`verificationStatus`, `mergeStatus`, `cleanupStatus`, and `finalGitStatus`.

The projected object should treat `threadId` as advisory navigation only and
`finalGitStatus: not_captured` as the expected F1 value unless existing run
evidence explicitly contains a reviewed final git status source in a later
slice.

## Evidence Boundary

The F1 helper should only project evidence from existing run log data. It must
not use model judgment, hidden memory, thread summaries, operator notes, or
worker assertions as trusted state.

The summary must remain advisory. The source of truth stays with Samantha run
evidence: `HARNESS_RESULT`, top-level pass/fail, changed-file scope,
deterministic verification results, candidate commit evidence, and lifecycle
trajectory records. Any UI, CLI, report, or operator-facing summary built later
must show or link back to those evidence sources instead of replacing them.

## Final Git Status Handling

F1 should set `finalGitStatus: not_captured`.

This value should mean that final repository state is not available as a
uniform trusted field in the existing run log shape. F1 must not infer final
git cleanliness from `result.pass`, `result.evaluation.harness.status`,
`result.commit.commitHash`, merge trajectory events, cleanup trajectory events,
or absence of reported scope violations.

If final git status becomes required later, that should be a separate reviewed
design and implementation slice that defines where the evidence is captured,
how it is verified, and how stale or missing snapshots are represented.

## Failed / Rework / Blocked State Handling

F1 should separate these states instead of flattening them into a single pass
or fail label:

- `harnessStatus`: project from `result.evaluation.harness.status`, including
  pass, rework, blocked, failed, missing, or unparseable harness result states.
- `topLevelPass`: project from `result.pass` as a separate run-task outcome.
- `candidateCommitStatus`: project from `result.commit.commitHash` as present
  or missing candidate commit evidence.
- `scopeStatus`: project from `result.evaluation.changedFiles` and
  `result.evaluation.scopeViolations` as in scope, scope violations present,
  changed files missing, or unknown.
- `verificationStatus`: project from `result.evaluation.verifyResults` as
  passed, failed, missing, or unknown.
- `mergeStatus`: project only from `trajectory` evidence, without inferring
  merge completion from pass or commit state.
- `cleanupStatus`: project only from `trajectory` evidence, without inferring
  cleanup completion from merge state.
- `finalGitStatus`: project as `not_captured` for F1.

Blocked or rework runs can still have useful scope, verification, commit,
merge, or cleanup evidence. Failed top-level runs can still contain a parsed
`HARNESS_RESULT`. The projection should preserve those distinctions so an
operator can diagnose the next action without granting authority to the
summary.

## F1 Implementation Candidate

Create a focused internal helper that accepts a parsed existing run log object
or a narrow run-log input wrapper, then returns a read-only visibility summary.
Test it with fixtures rather than live worker runs.

The helper should be internal until a later slice decides exposure. Its tests
should prove that it:

- reads only existing fields named in this report;
- preserves `threadId` as advisory navigation only;
- emits `finalGitStatus: not_captured`;
- separates `harnessStatus`, `topLevelPass`, `candidateCommitStatus`,
  `scopeStatus`, `verificationStatus`, `mergeStatus`, `cleanupStatus`, and
  `finalGitStatus`;
- does not imply accept, merge, cleanup, lifecycle completion, or worker-owned
  orchestration authority.

## Decisions Before F1

- Decide helper location and export boundary.
- Decide whether the helper input is a parsed run log object or a path reader
  that loads and parses the run log.
- Decide whether the summary object is internal helper only or exposed later
  through a command or report.
- Decide exact `finalGitStatus: not_captured` behavior for missing, stale, or
  future final git status evidence.
- Decide blocked, rework, and failed fixture shape for `HARNESS_RESULT`,
  top-level pass, scope, verification, candidate commit, merge, cleanup, and
  final git status combinations.

## Non-Goals

- No implementation code.
- No JSON schema changes.
- No CLI changes.
- No run-log field changes.
- No lifecycle implementation.
- No thread API automation.
- No scheduler, daemon, UI, MCP, or connector integration.
- No source code, tests, task specs, operation artifacts, lessons, or edits to
  Slice A/B/C/D/E documents.
- No accept, merge, cleanup, lifecycle, orchestration, worker allocation,
  worker dispatch, commit, push, policy, doctrine, background operation,
  budget governance, or multi-project orchestration authority.

## Stop Conditions

Stop before F1 implementation if the proposed next slice requires CLI
exposure, run-log shape changes, lifecycle state changes, thread API calls,
background operation, operator UI, connector integration, or final git status
capture before the helper boundary is reviewed.

Stop if the summary is treated as trusted evidence, if `threadId` is treated as
anything beyond advisory navigation, if worker-owned orchestration is implied,
or if the helper output is used to replace Samantha-owned accept, merge,
cleanup, lifecycle, verification, scope, commit, or report gates.
