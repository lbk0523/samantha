# Playbook: SDK Dogfood Runtime Selection

## Purpose

Use this playbook when choosing whether a Samantha self-build `run-task` or
bounded `batches:execute` execution should explicitly use
`--runtime=codex-sdk`.

S10 selected `codex-sdk` as the preferred dogfood runtime for Samantha
self-build tasks only. Batch execution may also receive an explicit
command-level runtime override for bounded Samantha self-build dogfood. This
does not change the CLI default. It does not authorize BatchSpec runtime policy,
report orchestration runtime selection, automatic fallback, App Server
integration, hidden UI state, daemon/watch services, dashboards, natural-language
dispatch, writerCap changes, or runtime-owned verification, scope, commit,
lifecycle, cleanup, push, or recovery authority.

## Default

The default runtime remains `exec-json`.

Use the default by omitting `--runtime`:

```bash
bun run samantha run-task <task.json> --repo-root=/Users/byung/Documents/samantha
bun run samantha batches:execute --batch-id=<batch-id>
```

Use the explicit fallback when a task should avoid SDK dogfood:

```bash
bun run samantha run-task <task.json> --repo-root=/Users/byung/Documents/samantha --runtime=exec-json
bun run samantha batches:execute --batch-id=<batch-id> --runtime=exec-json
```

## Choose `codex-sdk`

Prefer SDK dogfood only when all of these are true:

- The task is a Samantha self-build task in `/Users/byung/Documents/samantha`.
- The task is bounded by explicit target files, forbidden changes, and verify
  commands.
- The operator or task explicitly chooses SDK with `--runtime=codex-sdk`.
- For batch execution, the batch is bounded Samantha self-build dogfood and the
  operator explicitly chooses SDK on the `batches:execute` command.
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
  --runs-dir=runs \
  --runtime=codex-sdk

bun run samantha batches:execute --batch-id=<batch-id> \
  --batches-dir=references/batch-specs \
  --worktrees-dir=worktrees \
  --runs-dir=runs \
  --runtime=codex-sdk
```

## Do Not Choose `codex-sdk`

Use `exec-json` when any of these are true:

- The work is routine and does not benefit from SDK dogfood evidence.
- The task is outside Samantha self-build work.
- The SDK dependency, credentials, or local Codex state is currently suspect.
- The task is part of batch execution without an explicit bounded Samantha
  self-build dogfood decision.
- The work is report orchestration.
- The run would require automatic runtime fallback.
- The run would require App Server integration.
- The run would require BatchSpec-owned runtime policy, hidden UI state,
  writerCap changes, daemon/watch behavior, dashboards, or natural-language
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

Stop preferring SDK dogfood and use `--runtime=exec-json` if:

- SDK runtime failures are no longer diagnosable from run logs;
- `HARNESS_RESULT` preservation regresses;
- `runtime.kind` is missing from SDK run evidence;
- SDK thread state starts driving lifecycle or recovery decisions;
- SDK package movement violates
  `references/initiatives/sdk-adapter-s9-dependency-policy.md`;
- bounded SDK dogfood writes outside declared task authority.

Rollback does not require removing the SDK adapter. It means avoiding SDK
dogfood preference until a reviewed fix restores the S10 criteria.
