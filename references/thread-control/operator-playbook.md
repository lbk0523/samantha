# Samantha Thread Control Plane Operator Playbook

## Purpose

This playbook gives human operators and the main Samantha/CEO thread a bounded
procedure for using background Codex threads during Samantha thread-control
work.

The main Samantha/CEO thread may create, steer, and inspect background Codex
threads, but background threads are execution or supervision surfaces only.
They do not own orchestration, acceptance, lifecycle state, cleanup, merge,
push, policy, doctrine, or task-spec authority.

Use thread state to improve navigation and supervision. Do not treat thread
state as completion evidence: thread summary is advisory only.
trusted evidence remains Samantha run evidence.
worker-owned orchestration remains forbidden.

## When To Use

Use this playbook when a reviewed thread-control slice permits the main
Samantha/CEO thread to start or continue a background Codex thread for scoped
execution, supervision, diagnosis, or report-only review.

Do not use it to bypass Samantha's normal path from user goal to CEO
decomposition, TaskSpec, isolated worktree, Samantha worker run,
`HARNESS_RESULT`, deterministic verification, candidate commit, and lifecycle
record.

## Preflight

- Confirm the repository is clean before starting thread-control work.
- When executing a TaskSpec, confirm the TaskSpec path already exists and is
  the artifact being executed.
- Check that the target work is not already fully applied on main before
  dispatching or continuing a background thread.
- Confirm the slice allows background thread use and does not introduce new
  product surfaces or authority changes.
- Confirm deterministic verification is available before treating any output as
  acceptance-ready.

## Background Thread Prompt Shape

Keep background prompts compact and mechanical. This is an operator prompt
shape, not a schema or automation contract.

- Role: background Codex thread for scoped execution or supervision only.
- Context: TaskSpec path, current worktree, relevant slice, and authority
  boundary.
- Ask: perform the narrow task, or inspect and report on the narrow question.
- Scope: target files, forbidden files, and explicit non-goals.
- Evidence: required command outputs, `HARNESS_RESULT`, and verification notes.
- Stop: stop on scope drift, direct orchestration, lifecycle authority, missing
  TaskSpec, unclean repo, missing verification, or already-applied work.

## Steering And Stop Messages

For unnecessary discovery:

> Stop broad discovery. Use only the provided TaskSpec, target files, and
> immediate callers needed for the assigned scope. Report if that is
> insufficient.

For direct implementation drift:

> Stop direct implementation drift. Return to the declared target files and
> requested docs-only or worker-scoped output. Do not add product surfaces or
> adjacent changes.

For direct orchestration or lifecycle authority:

> Stop. You are attempting orchestration, acceptance, commit, cleanup, merge,
> push, or lifecycle authority. Background threads may report evidence only;
> Samantha owns the lifecycle decision.

## Trusted Evidence Checklist

Thread id and thread summary are navigation aids only. Completion and
acceptance require Samantha-owned evidence:

- run log path
- `HARNESS_RESULT`
- top-level run-task pass
- changed-file scope
- deterministic verification
- candidate commit
- merge / cleanup lifecycle
- final git status

## Accept / Do-Not-Accept Rules

Do not run `runs:accept` when the top-level run-task pass is false.

Do not run `runs:accept` when candidate commit is missing, scope violations
exist, verification fails, or a background thread implemented directly instead
of using Samantha self-build gates.

Accept only when Samantha-owned evidence shows the run completed inside scope,
verification passed deterministically, the candidate commit exists, and the
lifecycle state is ready for acceptance.

## Final Report Checklist

Final operator reports should name:

- TaskSpec path
- command
- run log path
- `HARNESS_RESULT` status
- changed-file scope
- verification result
- candidate commit
- lifecycle
- final git status
- observed thread-control friction

## Non-Goals

This playbook does not define or implement schemas, CLI flags, run-log fields,
thread API automation, background scheduler behavior, daemon behavior, UI, MCP,
connector integration, worker-owned orchestration, or lifecycle implementation.

It also does not add product automation, control-plane entrypoints, budget
governance, multi-project orchestration, policy changes, doctrine changes,
source code, tests, task templates, agent profiles, lessons, run records, or
operation artifacts.

## Stop Conditions

Stop when background thread output becomes the basis for trust instead of
Samantha run evidence.

Stop when a background thread attempts to own orchestration, acceptance,
cleanup, merge, push, lifecycle state, policy, doctrine, or task-spec
authority.

Stop when the repo is not clean, the required TaskSpec path is missing, target
work is already fully applied on main, verification is not deterministic, or
the slice would introduce schemas, automation contracts, product surfaces, or
authority changes outside reviewed scope.
