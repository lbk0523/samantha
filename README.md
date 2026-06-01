# Samantha Harness

Samantha is a local development harness for deciding when agent-produced work is
safe to accept.

It is not a more autonomous coding agent. It is a trust loop around coding
agents: define bounded work, run it in isolation, require explicit worker
evidence, run deterministic verification, and keep the final accept decision
outside the worker's judgment.

The first public path is intentionally small and is now available from the
published Bun-first npm package:

```bash
bunx @lbk0523/samantha demo:first-run
```

That command runs the loop against a disposable fixture repository under
`.samantha-demo/` so a local developer can inspect the evidence without
mutating a real project.

Clone-based local development remains supported with `bun run samantha
demo:first-run`. Samantha does not currently claim `npx`, `npm exec`, or
Node-general CLI support.

## What Samantha Is

Samantha is a CEO-style local harness for software work. It helps a user or
operator turn a minimal goal into a scoped task, send that task to a worker
runtime, and decide whether the result is acceptable from evidence rather than
trusting the worker's final message.

Samantha's job is to preserve boundaries:

- task scope is declared before execution;
- workers edit only inside isolated worktrees;
- target files and forbidden files are checked after the run;
- workers must emit `HARNESS_RESULT`;
- deterministic verification runs outside the worker's judgment;
- candidate commits and reports become evidence for a Samantha-owned accept
  decision.

The first public release path is a local trust demo, not a SaaS control plane,
remote operation system, background daemon, dashboard, connector platform,
budget governance layer, writer parallelism system, or multi-project
orchestrator.

## The Trust Loop

The core loop is:

```text
minimal user goal
-> Samantha task spec
-> isolated worker worktree
-> worker output with HARNESS_RESULT
-> deterministic verification
-> run log and candidate commit evidence
-> Samantha-owned accept or reject decision
```

No worker output becomes trusted work just because the worker says it is done.
The harness records what changed, whether the worker stayed in scope, whether
verification passed, and where the evidence lives.

## Quickstart: First-Run Demo

Run the published package with Bun:

```bash
bunx @lbk0523/samantha demo:first-run
```

Or, from a cloned checkout, install dependencies and run:

```bash
bun install --frozen-lockfile
bun run samantha demo:first-run
```

The demo creates a generated directory like:

```text
.samantha-demo/<demo-id>/
```

Inside that directory Samantha creates a disposable fixture repository, a worker
worktree, a generated task spec, and a run log. The worker task is deliberately
small: create one demo output file in the fixture repo and report
`HARNESS_RESULT`.

The command does not merge into your real repository. The generated
`.samantha-demo/<demo-id>/` directory is preserved after the run so you can
inspect the task spec, run log, worker worktree, and candidate commit. When you
are done inspecting it, remove the generated demo directory with the cleanup
command printed by the CLI:

```bash
rm -rf .samantha-demo/<demo-id>
```

The cleanup path is constrained to `.samantha-demo/`. The demo should not ask
you to remove a real project directory.

If you need to select the worker runtime explicitly, the accepted dogfood run
used:

```bash
bunx @lbk0523/samantha demo:first-run --runtime=codex-sdk
```

## What Success Looks Like

A successful first-run demo prints a compact summary in this shape:

```text
Samantha first-run demo: pass
demo id: demo-<timestamp>
fixture repo: .samantha-demo/<demo-id>/fixture-repo
worker worktree: .samantha-demo/<demo-id>/worktrees/open-source-first-run-demo
run log: .samantha-demo/<demo-id>/runs/<run-id>.json
HARNESS_RESULT: pass
verification: pass
candidate commit: <hash>
merge: not performed (disposable worker worktree only)
cleanup: rm -rf .samantha-demo/<demo-id>
```

The accepted public-readiness dogfood evidence is recorded at
[`references/operations/open-source-first-run-demo-dogfood.md`](references/operations/open-source-first-run-demo-dogfood.md).
That report records accepted demo implementation commit
`413991128f3f0718c05846d23c018a38c4c33c7f` as evidence that the demo path was
exercised. It is not a setup requirement for users.

The npm publication closeout is recorded at
[`references/operations/open-source-npm-publication-closeout.md`](references/operations/open-source-npm-publication-closeout.md).
It records `@lbk0523/samantha@0.1.0` public package evidence and a Bun-first
package-runner dogfood pass.

## What Samantha Will Not Do In The First Public Path

The first public path is intentionally narrow. It will not:

- mutate your real repository during `demo:first-run`;
- require private run history or local dogfood evidence;
- require `npx`, `npm exec`, or Node-general CLI support;
- settle license, contribution, security, or code-of-conduct governance;
- start remote operation, background automation, or connector/control-plane
  entrypoints;
- provide dashboards, budget governance, writer parallelism, or multi-project
  orchestration;
- present BatchSpec execution, lesson promotion, or advanced lifecycle commands
  as onboarding requirements.

Those areas need explicit design, authority boundaries, and verification before
they become public product surfaces.

## Core Concepts

**Task Spec**

A task spec declares the worker's goal, allowed target files, forbidden changes,
verification commands, expected commit subject, and final `HARNESS_RESULT`
requirement.

**Worker**

A worker is the agent process that attempts the scoped task. Workers do not own
orchestration, merge, push, cleanup, policy, or final trust decisions.

**Isolated Worktree**

Writer work happens in a separate worktree created for the task. This makes the
diff inspectable and keeps worker edits away from the operator's active checkout.

**Target Files And Forbidden Changes**

Samantha checks whether the worker changed only the declared target files and
avoided forbidden paths. Out-of-scope edits are evidence for rejection or rework.

**Deterministic Verification**

Verification commands are run after worker execution. They should prove the
intended behavior with deterministic checks instead of relying on a worker
summary.

**HARNESS_RESULT**

Workers must end with a machine-readable `HARNESS_RESULT` line. Samantha parses
it as worker evidence, then compares it against scope and verification evidence.

**Run Log And Report**

Run logs preserve prompt, command, runtime, changed files, parsed
`HARNESS_RESULT`, verification results, and candidate commit data. Reports are
human-readable summaries of that evidence.

**Candidate Commit And Accept Boundary**

Samantha can create a candidate commit after gates pass. Accepting, merging,
cleaning up, and publishing remain separate lifecycle decisions owned by the
harness/operator, not by the worker.

## Current Command Surface

Start here:

```bash
bunx @lbk0523/samantha demo:first-run
```

For clone-based local development, use `bun run samantha demo:first-run` after
`bun install --frozen-lockfile`.

Advanced command families exist for local harness operation and dogfood use.
They are authority-sensitive and should be used only when you understand the
task spec, run log, lifecycle, and cleanup boundaries:

- `run-task`
- `runs:*`
- `merge:check`
- `worktree:cleanup`
- `reports:*`
- `lessons:*`
- `continuation:*`
- `batches:*`
- `batch-plans:*`
- `readiness:check`
- `tasks:*`

The public quickstart intentionally does not require these commands.

## Repository Map

Public entrypoints:

- `README.md` explains the trust loop and first-run demo.
- `examples/first-run-demo/fixture-repo/` is the disposable fixture template
  copied by `demo:first-run`.
- `references/operations/open-source-first-run-demo-brief.md` records the demo
  contract.
- `references/operations/open-source-first-run-demo-dogfood.md` records accepted
  dogfood evidence for the first-run demo.
- `references/operations/open-source-artifact-map.md` and
  `references/operations/open-source-public-docs-plan.md` define the current
  public/dogfood documentation boundary.

Advanced or mixed evidence areas:

- `references/` is an evidence registry and planning archive, not a single
  public docs directory.
- `runs/**`, `worktrees/**`, `.samantha-worktrees/**`, and `.samantha-demo/**`
  are generated or local execution state.
- Direction and operating docs may include dogfood-specific authority rules
  until later public-generalization slices revise them.

## Feedback

First-run feedback is most useful when it includes evidence:

- OS, shell, Bun version, Git version, and selected worker runtime;
- exact command, especially `bun run samantha demo:first-run`;
- whether `.samantha-demo/<demo-id>/` was created;
- stage where the run failed: preflight, fixture setup, dispatch, worker,
  `HARNESS_RESULT`, deterministic verification, candidate commit, or cleanup;
- run log path, if available;
- cleanup status and whether the printed cleanup command stayed under
  `.samantha-demo/`;
- whether a gate felt too strict, too loose, or unclear;
- what you expected Samantha to do that it intentionally did not do.

Use the first-run failure issue template for demo failures and the workflow
feedback template for trust-gate friction.

## Release Maturity

Samantha is an active dogfood harness with a working first-run demo, not a
polished public platform. The current release path is for local developers who
want to inspect a trust loop around agent work and report where the evidence,
verification, or operator workflow is confusing.

Package publishing, license/governance files, broader public examples, remote
operation, background automation, dashboards, connector expansion, budget
governance, writer parallelism, and multi-project orchestration are not included
in this first public path.
