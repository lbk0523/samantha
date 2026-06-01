# First Run Guide

This guide explains the public first-run path for Samantha. It is for checking
that the CLI runs locally and for seeing how Samantha records evidence around a
small agent task.

## Install

Install the CLI from npm:

```bash
npm install -g @lbk0523/samantha
```

Then run:

```bash
samantha demo:first-run
```

You can also run the same check without installing the CLI:

```bash
bunx @lbk0523/samantha demo:first-run
```

## What The Command Does

`demo:first-run` creates a disposable fixture repository under
`.samantha-demo/` and runs a deliberately small worker task against it.

The command is designed to show the trust loop without touching your real
project:

- create a fixture repository;
- create an isolated worker worktree;
- generate a scoped task spec;
- run the worker;
- require `HARNESS_RESULT`;
- run deterministic verification;
- preserve the run log and candidate commit evidence.

## What To Inspect

After a successful run, the generated `.samantha-demo/<demo-id>/` directory is
left in place so you can inspect the evidence.

Useful files and directories include:

- `fixture-repo/` - the disposable repository used for the check;
- `worktrees/` - the isolated worker worktree;
- `runs/` - the run log with command, changed files, verification, and worker
  result evidence;
- the generated task spec named by the run output.

The exact paths are printed by the CLI at the end of the run.

## Cleanup

When you are done inspecting the generated evidence, remove the demo directory
with the cleanup command printed by the CLI:

```bash
rm -rf .samantha-demo/<demo-id>
```

The cleanup path should stay under `.samantha-demo/`. The first-run check should
not ask you to remove a real project directory.

## Runtime Selection

If you need to select the worker runtime explicitly, pass `--runtime`:

```bash
samantha demo:first-run --runtime=codex-sdk
```

The public package is Bun-first. Samantha does not currently claim `npx`,
`npm exec`, or Node-general CLI support.

## Development From Source

From a cloned checkout:

```bash
bun install --frozen-lockfile
bun run samantha demo:first-run
```

## Troubleshooting

For first-run failures, include this information when opening an issue:

- operating system, shell, Bun version, and Git version;
- exact command used;
- whether `.samantha-demo/<demo-id>/` was created;
- failure stage, if visible: preflight, fixture setup, dispatch, worker,
  `HARNESS_RESULT`, verification, candidate commit, or cleanup;
- run log path, if one was printed;
- whether the cleanup path stayed under `.samantha-demo/`.
