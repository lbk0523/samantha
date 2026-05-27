# Initiative: Post-Review Worker Execution Closure

Status: completed
Source: Samantha post-review fix planning, 2026-05-27
Last updated: 2026-05-27

## Goal

Close the remaining post-review correctness gaps in Samantha's existing worker
execution loop without reopening the original core worker five-slice trust
hardening plan.

The original five-slice plan is functionally complete. This initiative is a
separate residual closure effort for two review findings:

1. Writer no-op detection must not be satisfied by verification side effects.
2. Setup commands and worker runtime execution must have bounded timeout
   behavior with timeout evidence.

The useful outcome is a tighter existing worker loop:

```text
task spec
-> setup commands with timeout
-> bounded worker runtime
-> HARNESS_RESULT
-> pre-verification writer no-op gate
-> deterministic verification
-> Samantha-owned commit/report
```

## Accepted Decisions

- Treat this as a new initiative, not as a reopening of the original five-slice
  core worker trust hardening plan.
- Keep the work strictly inside the existing worker execution loop.
- Use three sequential slices so no-op authority, command-runner timeout
  behavior, and Codex SDK stream timeout behavior can be verified separately.
- Preserve all existing Samantha self-build gates: task spec planning artifact,
  isolated worktree, SDK-backed worker run, `HARNESS_RESULT`, deterministic
  verification, Samantha-owned accept/merge, lifecycle record, and cleanup.
- Do not dispatch any slice while the target repository is dirty. In particular,
  resolve the current untracked
  `hermes_samantha_workflow_integration_report.md` before dispatching workers.
- Keep timeout defaults deterministic in code. The planned defaults are
  `setupTimeoutMs = 60_000` and `workerTimeoutMs = 1_200_000` unless a slice
  finds a narrower reason to adjust them.
- Add only the minimal TaskSpec contract and validator consistency needed for
  `setupTimeoutMs` and `workerTimeoutMs`.

## Non-Goals

- No new CLI command surface.
- No dashboard, daemon, watch service, remote adapter, connector, or external
  analysis tool integration.
- No batch orchestration expansion.
- No `writerCap` increase.
- No policy broadening beyond what the focused tests require.
- No Graphify integration.
- No merge policy, cleanup policy, lesson promotion, or playbook promotion work.
- No task template migration unless a focused validator/test failure proves it
  is required for the timeout fields.
- No optional worker prompt wording polish in this initiative unless all
  correctness slices are already closed and BK explicitly asks for it.

## Invariants

- Samantha owns orchestration, worktree allocation, verification, integration,
  local commit/report, lifecycle evidence, and cleanup.
- Workers must not own orchestration, dispatch, merge, cleanup, commit, push,
  policy, doctrine, or lifecycle state.
- `HARNESS_RESULT` remains necessary but not sufficient for trusted completion.
- Verification side effects may appear in final changed-file evidence, but they
  must not count as proof that a writer worker produced the requested change.
- Every externally executed command in the worker execution path should have a
  bounded execution path and diagnosable timeout evidence.

## Slice Roadmap

### Slice A: No-Op Gate Correction

Status: accepted and cleaned

Lifecycle evidence:

- Accepted commit: `ac6c6b6054acc81e999c5a65dba54aa049ceba2d`
- Run log:
  `runs/2026-05-27T00-02-24-332Z-post-review-worker-execution-closure-slice-a-noop-gate.json`
- Cleanup evidence: `runs/run-lifecycle.jsonl`

Purpose: close the writer no-op bypass by basing no-op detection on
pre-verification worker-produced changes.

Target files:

- `src/core/worker-result.ts`
- `tests/worker-result.test.ts`

Forbidden changes:

- `src/core/policy.ts`
- `src/core/command-runner.ts`
- `src/core/worker-dispatch.ts`
- `src/core/worker-runtime-adapter.ts`
- `src/cli.ts`
- `references/**` except the Slice A task spec
- doctrine documents

Implementation direction:

- Keep final changed-file collection after verification so verification
  side effects are still visible to scope checks.
- Change the writer no-op allowance from final `changedFiles.length > 0` to
  pre-verification `initialChangedFiles.length > 0`.
- Preserve explicit no-op allowance only when `allowNoop === true` and
  `noopRationale` is a non-empty string.
- Preserve report-only behavior.

Required test intent:

- A writer task with no pre-verification changes fails even when a verify
  command creates a target file.
- The final changed files still include the verify-created target file.
- Scope violations remain empty when the verify-created file is inside
  `targetFiles`.
- Existing explicit no-op allowance tests still pass.

Verification:

```bash
bun test tests/worker-result.test.ts
bun run typecheck
bun test
```

Stop conditions:

- The fix requires touching timeout code.
- The test can only pass by weakening scope checks.
- Report-only baseline behavior changes.

### Slice B: Setup And Exec-Json Runtime Timeout

Status: accepted and cleaned

Lifecycle evidence:

- Accepted commit: `2032908465a4614bbe47acfc954ae7725e46eae9`
- Run log:
  `runs/2026-05-27T00-53-51-280Z-post-review-worker-execution-closure-slice-b-command-timeouts.json`
- Cleanup evidence: `runs/run-lifecycle.jsonl`

Purpose: add bounded timeout behavior to the shared command runner, setup
commands, and the exec-json worker runtime path.

Target files:

- `src/core/contracts.ts`
- `src/core/command-runner.ts`
- `src/core/worker-dispatch.ts`
- `src/core/worker-runtime-adapter.ts`
- `tests/worker-dispatch.test.ts`
- `tests/codex-dispatch.test.ts` or a focused worker runtime test
- minimal TaskSpec validator tests only if needed

Forbidden changes:

- `src/core/policy.ts`
- `src/core/batch-*.ts`
- `src/cli.ts`
- task templates unless forced by focused tests
- doctrine documents
- lifecycle, merge, cleanup, or lesson promotion code

Implementation direction:

- Add optional `setupTimeoutMs?: number` and `workerTimeoutMs?: number` to
  `TaskSpec`.
- Extend `CommandRunResult` with timeout evidence:
  `timedOut`, `timeoutMs`, and `timeoutDetails`.
- Add `timeoutMs` support to `runCommand`.
- On timeout, terminate the process group when possible, fall back to child
  kill, use a bounded cleanup grace, and return exit code `124`.
- Run setup commands sequentially with `setupTimeoutMs`; stop after the first
  non-zero or timed-out setup result.
- Ensure setup failure or timeout prevents worker runtime dispatch.
- Pass `workerTimeoutMs` through `executeWorkerDispatch` to the runtime adapter.
- Have the exec-json adapter call `runCommand` with the worker timeout.
- Update closed TaskSpec validator surfaces only where they would otherwise
  reject the new timeout fields.

Required test intent:

- `runCommand` without timeout preserves existing stdout, stderr, exit code,
  and timing behavior.
- `runCommand` with timeout returns exit code `124`, `timedOut: true`,
  `timeoutMs`, and timeout details.
- Timeout captures stdout/stderr emitted before timeout.
- SIGTERM-ignoring commands return within a bounded cleanup window.
- Setup commands stop after timeout and the worker adapter is not called.
- Exec-json runtime timeout returns timeout evidence.

Verification:

```bash
bun test tests/worker-dispatch.test.ts tests/codex-dispatch.test.ts
bun run typecheck
bun test
```

Stop conditions:

- The implementation requires adding CLI flags or a new command surface.
- The implementation weakens existing verification quality policy.
- Timeout evidence cannot be preserved through `CommandRunResult`.
- Setup timeout still allows worker runtime dispatch.

### Slice C: Codex SDK Runtime Timeout

Status: accepted and cleaned

Lifecycle evidence:

- Accepted commit: `226af80f77c012cc222e75227fd57a831bbc3455`
- Run log:
  `runs/2026-05-27T04-08-35-388Z-post-review-worker-execution-closure-slice-c-codex-sdk-timeout.json`
- Cleanup evidence: `runs/run-lifecycle.jsonl`

Purpose: bound Codex SDK worker runtime execution so a never-ending SDK stream
cannot hang the harness.

Target files:

- `src/core/worker-runtime-adapter.ts`
- `tests/worker-dispatch.test.ts` or a focused worker runtime adapter test

Forbidden changes:

- `src/core/policy.ts`
- `src/core/worker-result.ts`
- `src/core/command-runner.ts` unless Slice B left a narrow helper gap
- `src/core/batch-*.ts`
- `src/cli.ts`
- task templates
- doctrine documents

Implementation direction:

- Bound `thread.runStreamed()` and stream consumption with `workerTimeoutMs`.
- On timeout, return a `CommandRunResult` with exit code `124`, timeout
  evidence, partial stdout/final response where available, stderr explaining
  timeout, and any event counts already observed.
- Use an SDK abort or cancellation API if available.
- If the current SDK does not expose safe cancellation, implement the smallest
  bounded harness-facing result and leave a short code comment stating the
  limitation. Do not silently ignore timeout.
- Avoid background async work that keeps the process alive indefinitely.

Required test intent:

- A fake Codex SDK stream that never completes returns a timeout result after
  `workerTimeoutMs`.
- Partial event counts and thread id are preserved when available.
- Existing SDK success, `turn.failed`, stream error, and thrown client exception
  tests still pass.

Verification:

```bash
bun test tests/worker-dispatch.test.ts
bun run typecheck
bun test
```

Stop conditions:

- The SDK timeout path cannot return without leaving the harness process stuck.
- The implementation requires worker-owned orchestration or retries.
- Existing SDK error evidence is lost or made ambiguous.

## Completion Rule

This initiative is complete only when all three slices have accepted run
evidence and cleanup lifecycle evidence, and the final full verification passes.

Completion requires:

- writer no-op tasks with no pre-verification changes fail;
- verify-created target files do not allow writer no-op pass;
- explicit `allowNoop` plus non-empty `noopRationale` still passes;
- report-only evaluation remains unchanged;
- setup command timeout is enforced and recorded;
- setup timeout prevents worker dispatch;
- exec-json worker runtime timeout is enforced and recorded;
- Codex SDK worker runtime timeout returns bounded timeout evidence;
- existing verify timeout behavior still passes;
- `bun run typecheck` passes;
- focused tests pass;
- full `bun test` passes.

## Current Next Action

No ready next slice. This initiative is closed.

If future work finds adjacent lifecycle or artifact-retention questions, route
them through a separate reviewed initiative boundary instead of appending them
silently here.
