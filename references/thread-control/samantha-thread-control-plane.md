# Samantha Thread Control Plane

## Purpose

Samantha Thread Control Plane introduces an operator-visible way for the main
Samantha/CEO thread to create, steer, and inspect background Codex threads
without transferring orchestration authority to those threads.

The control plane is a coordination surface for thread context, supervision,
and review. It does not replace task specs, isolated worktrees, run logs,
`HARNESS_RESULT`, deterministic verification, candidate commits, or lifecycle
records.

## Background

Samantha already treats Codex SDK thread state as useful context but not trusted
state. Thread continuity can help BK and the CEO thread understand what a
worker saw, why a recovery path exists, or where a supervision thread should
focus next.

That context must remain bounded. A thread summary is advisory only, and
trusted evidence remains Samantha run evidence.

## Authority Boundary

The main Samantha/CEO thread may create, steer, and inspect background Codex
threads when a reviewed slice permits it. Background threads are execution or
supervision surfaces only. They must not own orchestration, worker merge, push,
cleanup, lifecycle transitions, policy changes, doctrine changes, task-spec
authority, or acceptance decisions.

worker-owned orchestration remains forbidden. Background threads may report
observations, produce scoped worker output, or support review, but Samantha
must continue to own decomposition, dispatch, verification, commit/report
evidence, and lifecycle state.

## Trusted Evidence

Trusted evidence is the Samantha run log, `HARNESS_RESULT`, changed-file scope,
deterministic verification, candidate commit, and lifecycle record.

Thread ids, thread summaries, streamed event counts, continuation notes, and
operator-visible conversation state may improve diagnosis, but they do not
prove completion or acceptance.

Thread identity and UI navigability are separate. A Codex SDK/exec bridge
thread may have durable turns and be readable by id while still being absent
from the app thread list or opening as an empty view through a generated
`::created-thread{...}` button. The control plane must label those threads as
read-by-id navigation only unless UI-native visibility has been verified.

## Non-Goals

- Do not add thread API automation in this brief.
- Do not add background scheduler behavior.
- Do not add worker-owned orchestration.
- Do not add connector or control-plane entrypoints.
- Do not add budget governance, operator UI, or multi-project orchestration.
- Do not change schemas, CLI behavior, run-log implementation, task templates,
  agent profiles, lifecycle gates, source code, tests, or operation artifacts.

## Dogfood Lessons

The first thread-control dogfoods exposed two boundaries that the control plane
must preserve:

- An already-applied `TaskSpec` can yield `HARNESS_RESULT` pass while the
  top-level `run-task` pass is false because no candidate commit exists. The
  thread view must not flatten those states into a trusted pass.
- Long delegation prompts can cause unnecessary discovery. Thread-control
  work needs short mechanical prompt shapes or Chief-of-Staff steering so the
  background thread stays inside its assigned role.
- SDK-created exec threads can be valid monitor threads without being
  UI-navigable chats. Do not expose a `::created-thread{...}` UI button for
  those threads unless app-native visibility has been checked; otherwise report
  the thread id with the read-by-id management command.

## Phased Roadmap

- Slice A: context brief.
- Slice B: operator playbook.
- Slice C: linkage artifact design.
- Slice D: manual linkage dogfood.
- Slice E: run progress visibility design.
- Slice F: implementation slices only after reviewed evidence.

## Stop Conditions

Stop before implementation or routine use when any path would make a background
thread authoritative for orchestration, acceptance, lifecycle state, cleanup,
merge, push, policy, doctrine, or product-boundary decisions.

Stop when evidence depends on thread summaries instead of Samantha run
evidence, when a slice lacks reviewed scope, when required verification is not
deterministic, or when new product surfaces are being introduced before the
roadmap phase that explicitly authorizes them.
