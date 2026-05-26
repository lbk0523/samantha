# Playbook: SDK Dogfood Runtime Selection

## Purpose

Use this playbook when choosing the runtime for `samantha run-task` or bounded
`batches:execute` execution.

S12 supersedes the old self-build-only dogfood selection rule for `run-task`:
omitting `--runtime` on `samantha run-task` now selects `codex-sdk`. Explicit
`--runtime=exec-json` remains the run-task fallback. Batch execution is not
promoted; omitting `--runtime` on `batches:execute` still selects `exec-json`,
with `--runtime=codex-sdk` available only as an explicit bounded dogfood
choice.

This does not authorize BatchSpec runtime policy, report orchestration runtime
selection, automatic fallback, App Server integration, hidden UI state,
background operation, operator UIs, natural-language dispatch, writerCap
changes, or runtime-owned verification, scope, commit, lifecycle, cleanup,
push, or recovery authority.

## Default

The `run-task` default is `codex-sdk`. The `batches:execute` default remains
`exec-json`.

Use the default by omitting `--runtime`:

```bash
bun run samantha run-task <task.json> --repo-root=/Users/byung/Documents/samantha
bun run samantha batches:execute --batch-id=<batch-id>
```

Use the explicit run-task fallback when a task should avoid SDK runtime:

```bash
bun run samantha run-task <task.json> --repo-root=/Users/byung/Documents/samantha --runtime=exec-json
```

## Choose `codex-sdk`

For `run-task`, omitted runtime already chooses `codex-sdk`. For
`batches:execute`, choose `--runtime=codex-sdk` only when all of these are true:

- The task is a Samantha self-build task in `/Users/byung/Documents/samantha`.
- The task is bounded by explicit target files, forbidden changes, and verify
  commands.
- The batch is bounded Samantha self-build dogfood and the operator explicitly
  chooses SDK on the `batches:execute` command.
- The run can tolerate SDK failure and can be rerun or followed up through
  Samantha run evidence.
- Runtime metadata, SDK thread continuity, or runtime-error diagnosability is
  useful evidence for the task or initiative.
- The task does not require new authority boundaries or a new runtime selector
  architecture.

Example:

```bash
bun run samantha run-task references/tasks/<task>.json \
  --repo-root=/Users/byung/Documents/samantha \
  --agent=references/agent-profiles/codex-worker.json \
  --worktrees-dir=worktrees \
  --runs-dir=runs

bun run samantha batches:execute --batch-id=<batch-id> \
  --batches-dir=references/batch-specs \
  --worktrees-dir=worktrees \
  --runs-dir=runs \
  --runtime=codex-sdk
```

## Do Not Choose `codex-sdk`

Use explicit `run-task --runtime=exec-json`, or keep the omitted
`batches:execute` default, when any of these are true:

- The SDK dependency, credentials, or local Codex state is currently suspect.
- The task is part of batch execution without an explicit bounded Samantha
  self-build dogfood decision.
- The work is report orchestration.
- The run would require automatic runtime fallback.
- The run would require App Server integration.
- The run would require BatchSpec-owned runtime policy, hidden UI state,
  writerCap changes, background operation, operator UIs, or natural-language
  dispatch.
- The run would move verification, scope checks, commits, lifecycle, cleanup,
  push, recovery, or orchestration into the runtime adapter.
- The task is broad enough that SDK failure would obscure the intended
  verification signal.

## Evidence To Check

After an SDK dogfood run, inspect the run log for:

- `result.runtime.kind` is `codex-sdk`;
- `result.runtime.threadId` when the run reached `thread.started`;
- `result.runtime.eventCounts` when events were available;
- `result.command.exitCode` and `result.command.stderr` for runtime failures;
- Samantha-owned evaluation, scope checks, verify results, and commits remain
  outside runtime metadata.

If the run fails, use `runs:diagnose` or `tasks:from-run` from the run log.
Treat any SDK thread id only as optional recovery context. The follow-up task
spec, repository state, target files, forbidden changes, and verify commands
remain authoritative.

## Rollback

Use `run-task --runtime=exec-json` and stop promoting SDK as the run-task
default if:

- SDK runtime failures are no longer diagnosable from run logs;
- `HARNESS_RESULT` preservation regresses;
- `runtime.kind` is missing from SDK run evidence;
- SDK thread state starts driving lifecycle or recovery decisions;
- SDK package movement violates
  `references/initiatives/sdk-adapter-s9-dependency-policy.md`;
- bounded SDK dogfood writes outside declared task authority.

Rollback does not require removing the SDK adapter. It means avoiding SDK
run-task default usage until a reviewed fix restores the S12 criteria.
