# Playbook: Self-Build Task Spec Lifecycle

## Purpose

Use this playbook when choosing how a Samantha self-build worker run receives
its task spec.

Task specs have lifecycle meaning. A persistent task spec under
`references/tasks/<id>.json` is a Samantha-owned planning artifact. If Samantha
uses that path, the task spec must be committed before worker dispatch, and the
worker must start from a clean base that already includes the committed planning
artifact.

An ephemeral or ad-hoc task spec is temporary run input. It must live outside
the repository, such as under `/tmp`, and Samantha must not backfill
`references/tasks/**` with that task spec after the worker run.

This rule preserves auditability. It does not give workers new authority over
planning artifacts, commits, dispatch, lifecycle state, cleanup, promotion, or
repository history.

## Choose A Persistent Task Spec

Use `references/tasks/<id>.json` when the task spec should remain part of the
reviewable project record before execution, such as when:

- the task is a planned Samantha self-build writer task;
- BK or Samantha needs the task instructions to survive beyond one run;
- the task belongs to an initiative, roadmap slice, recovery chain, or other
  auditable planning trail;
- future review should compare the worker run against a stable committed spec;
- the spec itself is the planning artifact Samantha wants to preserve.

A persistent task spec is not scratch space. Placing a spec under
`references/tasks/` means Samantha is choosing to preserve it before dispatch.

## Choose An Ephemeral Task Spec

Use an out-of-repo path such as `/tmp/<task>.json` when the task spec is only
run input, such as when:

- Samantha is dogfooding a narrow command path or runtime behavior;
- the operator is testing dispatch mechanics and does not need a durable
  planning artifact;
- the task is temporary, local, or generated from another already committed
  source;
- preserving the exact task JSON would add noise rather than useful planning
  evidence.

Ephemeral specs may still produce run evidence. The run log, verification
output, changed-file scope, and `HARNESS_RESULT` remain the auditable execution
record.

## Pre-Dispatch Gates

Before dispatching a worker from a persistent task spec, Samantha must verify:

- the task spec path is `references/tasks/<id>.json`;
- the spec is intentionally in the declared planning scope;
- the spec is committed before dispatch;
- the worktree or worker base is clean;
- the base commit includes the committed task spec;
- target files, forbidden changes, and verify commands are explicit;
- the selected runtime and agent profile do not change the authority boundary;
- no worker is being asked to edit `references/tasks/**` unless the task
  explicitly authorizes that path as its target file.

Before dispatching a worker from an ephemeral task spec, Samantha must verify:

- the task spec path is outside the repository, for example under `/tmp`;
- the task spec is not staged, committed, copied, or symlinked into the repo;
- the worker base is clean;
- target files, forbidden changes, and verify commands are explicit;
- the run log will preserve enough task input or task metadata to audit the
  execution path;
- the run is not relying on a future post-run commit of the task spec for
  legitimacy.

If either path cannot satisfy its gates, stop before dispatch.

## Post-Run Restrictions

After a persistent-spec run:

- evaluate the worker output against the committed task spec;
- keep accepted worker output in a later Samantha-owned commit or report;
- do not rewrite the planning commit to absorb worker output;
- do not let the worker mutate task spec lifecycle state;
- preserve run evidence, scope checks, verification output, and
  `HARNESS_RESULT` as the execution audit trail.

After an ephemeral-spec run:

- do not create, copy, or reconstruct `references/tasks/<id>.json` from the
  temporary spec after the run;
- do not treat a post-hoc task spec as pre-dispatch planning evidence;
- preserve the run log as the execution record;
- if the same work should become durable planning, create a new planning task
  before a future dispatch and commit it before that future worker run.

The sequence is always:

```text
persistent planning artifact -> commit -> clean worker base -> dispatch
```

Never:

```text
ephemeral dispatch -> worker run -> backfilled references/tasks artifact
```

## Authority Limits

This playbook authorizes Samantha to choose and document a task spec lifecycle
path. It does not authorize:

- workers to commit, push, merge, clean worktrees, or mutate lifecycle state;
- workers to create or backfill `references/tasks/**` unless that exact path is
  a declared target file;
- automatic task spec promotion from `/tmp` into `references/tasks/`;
- automatic dispatch, automatic commit behavior, or hidden memory;
- changes to CLI/runtime/policy implementation;
- daemon/watch services, remote adapters, dashboards, routines, budget
  governance, or multi-project orchestration.

Samantha owns orchestration, worktree allocation, verification, commit, and
report evidence. A task spec lifecycle choice must not increase worker
authority.

## Verification Expectations

For a persistent-spec run, verification evidence should show:

- the planning commit containing `references/tasks/<id>.json`;
- a clean worker base at dispatch;
- the worker base includes the planning commit;
- changed-file scope matches the task;
- deterministic verify commands ran;
- run evidence includes `HARNESS_RESULT`.

For an ephemeral-spec run, verification evidence should show:

- the task spec path was outside the repo;
- no `references/tasks/**` file was added after dispatch for that spec;
- changed-file scope matches the task;
- deterministic verify commands ran;
- run evidence includes `HARNESS_RESULT`.

For docs-only edits to this playbook or related pointers, run the markdown diff
check specified by the task.

## Stop Conditions

Stop and report the reason before dispatch when:

- a persistent task spec is uncommitted;
- the worker base is dirty or does not include the planning commit;
- an ephemeral task spec is inside the repository;
- Samantha would need to backfill `references/tasks/**` after an ephemeral run;
- the requested path would let a worker grant itself planning, dispatch,
  lifecycle, commit, cleanup, push, or promotion authority;
- target files, forbidden changes, or verify commands are missing;
- the task would require implementation of CLI/runtime/policy automation when
  only this lifecycle rule was requested.

Stop after a run when verification fails, scope checks fail, `HARNESS_RESULT`
is missing or malformed, or the available evidence cannot prove which task spec
lifecycle path was used.
