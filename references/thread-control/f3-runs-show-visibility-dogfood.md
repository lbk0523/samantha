# Samantha Thread Control Plane F3 runs:show Visibility Dogfood

## Purpose

This docs-only dogfood report records how the F2 `runs:show`
`visibilitySummary` surface behaved on an accepted Samantha Thread Control Plane
run. It evaluates operator visibility only. It does not authorize source code,
test, lifecycle, task spec, operation, lesson, merge, cleanup, worker dispatch,
thread API, scheduler, daemon, UI, MCP, connector, or final git status capture
changes.

The boundary remains explicit:

- thread summary is advisory only
- trusted evidence remains Samantha run evidence
- worker-owned orchestration remains forbidden
- must not replace accept, merge, cleanup, or lifecycle gates

## Source Evidence

Primary source:

- Run id:
  `2026-05-30T15-47-24-877Z-samantha-thread-control-plane-f2`
- Run log:
  `runs/2026-05-30T15-47-24-877Z-samantha-thread-control-plane-f2.json`
- Accepted F2 task:
  `samantha-thread-control-plane-f2`
- F2 title:
  `Expose run visibility summary through runs show`

Read-only inspection used the accepted F2 run evidence and the
`bun run samantha runs:show 2026-05-30T15-47-24-877Z-samantha-thread-control-plane-f2`
surface. The run log recorded a parsed `HARNESS_RESULT` with
`harnessStatus: pass`, top-level `pass: true`, changed files limited to
`src/core/run-show.ts` and `tests/run-show.test.ts`, zero scope violations,
three passed verification commands, candidate commit
`6286286557f485b383d1a5e532aa2217509dc42e`, completed merge evidence, and
completed cleanup evidence.

## Observed visibilitySummary

The observed `visibilitySummary` reduced navigation friction by showing
`threadNavigation`, `harnessStatus`, `topLevelPass`, `candidateCommitStatus`,
`scopeStatus`, `verificationStatus`, `mergeStatus`, `cleanupStatus`, and
`finalGitStatus` in one surface.

Observed values:

- `threadNavigation`: `status: available`, with thread id
  `019e7991-9afb-7b43-b12d-e9d33756bc90`
- `harnessStatus`: `pass`
- `topLevelPass`: `true`
- `candidateCommitStatus`: `present`
- `candidateCommitHash`: `6286286557f485b383d1a5e532aa2217509dc42e`
- `scopeStatus`: `in_scope`
- `changedFileCount`: `2`
- `scopeViolationCount`: `0`
- `verificationStatus`: `passed`
- `verificationResultCount`: `3`
- `mergeStatus`: `completed`
- `cleanupStatus`: `completed`
- `finalGitStatus`: `not_captured`

`finalGitStatus` remains `finalGitStatus: not_captured` and should not be
inferred from merge or cleanup.

## Gate Preservation

The F2 surface correctly reads as an advisory projection over existing run
evidence. It does not claim to accept the run, merge the candidate commit,
clean up the worktree, mark lifecycle state, verify final repository state, or
replace Samantha-owned report evidence.

`threadNavigation` helps the operator find the related worker thread, but the
thread id does not prove completion, scope, verification, merge, cleanup, or
final git status. The trusted evidence remains the run log, parsed
`HARNESS_RESULT`, deterministic verification results, changed-file scope
evidence, commit evidence, trajectory events, lifecycle record, and
Samantha-owned lifecycle gates.

## Dogfood Findings

The one-surface projection made the accepted F2 run easier to inspect because
the operator did not need to manually jump between `summary`, `log`,
`trajectory`, `result.evaluation`, `result.runtime`, and `lifecycle` to answer
the first visibility questions.

The summary preserved important distinctions:

- `harnessStatus: pass` stayed separate from `topLevelPass: true`.
- Candidate commit presence stayed separate from verification, merge, and
  cleanup evidence.
- `scopeStatus: in_scope` and `verificationStatus: passed` remained visible as
  independent gates.
- `mergeStatus: completed` and `cleanupStatus: completed` came from lifecycle
  and trajectory evidence, not from thread state.
- `finalGitStatus: not_captured` stayed explicit even though merge and cleanup
  were completed.

## Friction

The field names are useful for fast inspection, but the surface still requires
operators to remember that the summary is not itself a lifecycle gate. This is
acceptable for F3 because the report is dogfood-only and the summary is
advisory.

In an unprepared docs-only worktree, invoking `runs:show` can fail before
inspection if runtime dependencies have not been installed. That is setup
friction around local inspection, not a failure of the accepted F2 run evidence.

## Next Slice Candidate

A later reviewed slice could define final git status capture as a separate
evidence source, including when the snapshot is taken, how stale or missing
state is represented, and which deterministic command proves the result.

That later slice should stay explicit that final git status capture is not
already provided by merge completion, cleanup completion, candidate commit
presence, or a passing `HARNESS_RESULT`.

## Non-Goals

- No source code changes.
- No test changes.
- No run-log shape changes.
- No lifecycle state changes.
- No task spec, operation, lesson, playbook, or agent profile changes.
- No CLI behavior changes.
- No thread API automation.
- No scheduler, daemon, UI, MCP, or connector integration.
- No worker dispatch, worker merge, push, cleanup, or orchestration authority.
- No immediate final git status capture implementation.
- No use of thread summaries as trusted evidence.

## Stop Conditions

Stop if `visibilitySummary` is treated as trusted state instead of advisory
run-evidence navigation.

Stop if `threadNavigation` is used to prove run completion, scope compliance,
verification status, merge status, cleanup status, lifecycle status, or final
git status.

Stop if final git status is inferred from merge or cleanup instead of captured
by a later reviewed evidence source.

Stop if this report is used to bypass accept, merge, cleanup, lifecycle,
verification, scope, commit, or Samantha-owned report gates.
