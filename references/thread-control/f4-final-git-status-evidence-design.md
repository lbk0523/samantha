# Samantha Thread Control Plane F4 Final Git Status Evidence Design

## Purpose

This document designs the evidence boundary for a later `finalGitStatus`
capture slice in Samantha Thread Control Plane run visibility.

The goal is to make the final repository cleanliness question visible without
turning the thread summary into trusted state. The thread projection may help an
operator navigate run evidence, but thread summary is advisory only, trusted
evidence remains Samantha run evidence, worker-owned orchestration remains
forbidden, and any final git status evidence must not replace accept, merge,
cleanup, or lifecycle gates.

## Source Findings

F3 found that `runs:show` `visibilitySummary` helps navigation across accepted
run evidence. It reduced the need to manually inspect multiple run-log,
trajectory, evaluation, runtime, and lifecycle locations for first-pass
visibility.

F3 also found that `finalGitStatus` remains `not_captured`. That value is
important because final repository cleanliness must not be inferred from merge
completion, cleanup completion, candidate commit presence, or a passing
`HARNESS_RESULT`.

The source finding for F4 is therefore narrow: `visibilitySummary` can expose a
future final git status signal, but it does not currently provide one and must
not synthesize one from nearby lifecycle evidence.

## Evidence Boundary

Final git status evidence should answer only whether the target repository is
clean at a specific post-accept point in the Samantha lifecycle.

It should remain a deterministic evidence snapshot captured by Samantha. It
should not be captured by the worker, not by thread summary, and not by model
judgment. The worker has no authority to prove final repository state because
worker-owned orchestration remains forbidden.

The evidence should support operator visibility after lifecycle work, but must
not become a new authority gate that silently substitutes for existing gates.
It must not replace accept, merge, cleanup, or lifecycle gates, and it must not
replace scope, verification, candidate commit, or report evidence.

## Candidate Capture Points

Worker run verification is too early. It can prove the worker's declared checks
inside the isolated worktree, but it cannot answer whether the target repo is
clean after Samantha accept, merge, and cleanup.

Merge check is also too early. It can evaluate whether a candidate can be
merged or whether merge prerequisites hold, but it cannot prove the repository
state after the lifecycle has completed.

Merge completion is useful lifecycle evidence, but it is not final repository
cleanliness evidence. A completed merge does not prove cleanup completion, and
it does not prove that no unexpected files remain in the target repository.

Cleanup completion is closer, but still not sufficient by itself. Cleanup
evidence can show that Samantha completed cleanup actions, but final git status
must not be inferred from cleanup completion.

Post-cleanup target repo status is the only candidate capture point that can
answer whether the target repo is clean after accept lifecycle. It can be
captured after cleanup completes, using a deterministic repository status
inspection in the target repo.

## Recommended Capture Point

The recommended capture point is post-cleanup target repo status.

Samantha should capture this after cleanup, not before worker verification, not
during merge checks, not at merge completion, and not as a replacement for
cleanup completion. The capture belongs to Samantha because Samantha owns the
accept lifecycle, target repo merge, cleanup, and report evidence.

This is a later implementation candidate only. The later slice must define the
exact deterministic command, stale or unavailable-state handling, and where the
captured evidence is recorded.

## Proposed Evidence Shape

The evidence can be descriptive and compact. It should identify that final git
status was captured after cleanup, record whether the target repository appeared
clean or dirty, and retain enough command evidence for deterministic review.

Useful descriptive fields may include capture timing, repository path, clean or
dirty status, the command used, command exit status, concise stdout or stderr
summary, and whether the evidence was unavailable.

This section is not a JSON schema or implementation contract. A later
implementation slice should choose the concrete storage shape only after
reviewing the existing run-log and lifecycle evidence conventions.

## Visibility Projection Impact

`visibilitySummary.finalGitStatus` should remain a projection over captured
Samantha evidence. If no post-cleanup target repo status evidence exists, it
should stay visibly absent or `not_captured`.

If evidence exists, `runs:show` may project the captured status to help operator
navigation. The projection should preserve the source distinction: thread
summary is advisory only, and trusted evidence remains Samantha run evidence.

The projection should not claim that final git status completes accept, merge,
cleanup, lifecycle, scope, verification, candidate commit, or report gates.

## Verification Strategy

The later implementation should be verified with deterministic checks that
prove the capture happens after cleanup and that missing evidence remains
reported as not captured instead of inferred.

Focused tests should cover at least these intents:

- no final git status evidence keeps `finalGitStatus` not captured
- merge completion alone does not produce final git status
- cleanup completion alone does not produce final git status
- post-cleanup target repo status evidence is projected without becoming a gate
- dirty target repo status remains visible instead of being hidden by pass,
  merge, or cleanup status

Manual dogfood evidence should use a real accepted run only after the
implementation has deterministic test coverage.

## Non-Goals

- No source code changes in this design slice.
- No test changes in this design slice.
- No schema, CLI, run-log field, or lifecycle implementation contract.
- No thread API automation.
- No scheduler, daemon, UI, MCP, or connector integration.
- No worker dispatch, worker merge, push, cleanup, or orchestration authority.
- No task spec, operation artifact, lesson, playbook, or agent profile change.
- No inference of final git status from merge completion.
- No inference of final git status from cleanup completion.
- No use of model judgment as repository cleanliness evidence.

## Stop Conditions

Stop if this design would make `finalGitStatus` replace accept, merge, cleanup,
lifecycle, scope, verification, candidate commit, or report gates.

Stop if final git status would be captured by the worker, by thread summary, or
by model judgment.

Stop if merge completion or cleanup completion would be treated as proof that
the target repo is clean.

Stop if the later slice cannot keep the capture deterministic and
Samantha-owned.

## Next Implementation Candidate

The next implementation candidate is a narrow, reviewed slice that captures
post-cleanup target repo status after Samantha cleanup completes and projects
that captured evidence through `runs:show`.

That slice should define the deterministic command, the evidence recording
location, unavailable-state behavior, and focused tests. It should keep
`finalGitStatus` as visibility evidence only and preserve the rule that it must
not replace accept, merge, cleanup, or lifecycle gates.
