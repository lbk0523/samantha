# Open Source Release Note Draft

Status: draft public copy

Samantha now has a first public local demo for its trust loop:

```bash
bun run samantha demo:first-run
```

The demo runs against a disposable fixture repository under `.samantha-demo/`.
It creates an isolated worker worktree, requires `HARNESS_RESULT`, runs
deterministic verification, records a run log, and prints the cleanup command
for the generated demo directory.

This release is intentionally early. Samantha is an active dogfood harness for
local developer workflows, not a polished platform. The first public goal is to
make the trust gates inspectable: task scope, worker output, verification,
candidate commit evidence, and cleanup status should be visible enough for a
user to decide whether the harness accepted or rejected work for the right
reason.

Feedback requested:

- whether `bun run samantha demo:first-run` works on your environment;
- the selected runtime, exact command, stage, and run log path for failures;
- the parsed `HARNESS_RESULT` and verification evidence when available;
- whether `.samantha-demo/<demo-id>/` cleanup status was clear;
- where gate friction felt too strict, too loose, or unclear;
- what you expected Samantha to do that it intentionally did not do.

Not included in this first public path:

- remote operation or background automation;
- dashboards or connector/control-plane expansion;
- budget governance;
- writer parallelism;
- multi-project orchestration;
- package publishing claims;
- license/governance decisions beyond this draft release copy.

Accepted first-run dogfood evidence is recorded at
`references/operations/open-source-first-run-demo-dogfood.md`. The accepted demo
implementation commit `413991128f3f0718c05846d23c018a38c4c33c7f` is evidence
for the public demo path, not a user setup requirement.
