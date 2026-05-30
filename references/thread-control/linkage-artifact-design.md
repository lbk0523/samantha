# Samantha Thread Control Plane Linkage Artifact Design

## Purpose

This note defines an advisory linkage artifact for Samantha Thread Control
Plane Slice C.

Advisory linkage is a navigation record connecting a background Codex thread
to Samantha run evidence. It helps an operator find the relevant run log,
lifecycle state, and verification material faster, but it does not create a
trusted evidence source.

thread summary is advisory only. trusted evidence remains Samantha run evidence.
worker-owned orchestration remains forbidden.

## Linkage Boundary

The linkage artifact may point from a background thread to Samantha-owned run
evidence, but it must not become a JSON schema, formal data contract, CLI
design, run-log field design, automation plan, or lifecycle authority surface.

The linkage may describe where to look. It must not decide whether a run
passed, whether a candidate commit is acceptable, whether cleanup is complete,
or whether lifecycle state may advance.

Thread id, thread summary, streamed events, and operator notes do not prove
success.

## Advisory Linkage Fields

Advisory linkage may mention:

- background thread id
- task spec path
- run log path
- run id
- command
- candidate commit
- lifecycle status
- final git status
- short operator notes

These fields are navigation aids only. Missing, stale, or incorrect advisory
fields must be resolved by reading Samantha-owned evidence directly.

## Trusted Evidence References

Trusted evidence must remain Samantha run log, `HARNESS_RESULT`, changed-file
scope, deterministic verification, candidate commit, and lifecycle record.

The linkage artifact may reference those evidence sources, but it must not replace accept, merge, cleanup, or lifecycle gates.

## Invalid Uses

- Treating a thread summary as proof that implementation succeeded.
- Treating streamed events as deterministic verification.
- Treating operator notes as a substitute for `HARNESS_RESULT`.
- Treating an already-applied TaskSpec as an accepted run without candidate
  commit evidence.
- Treating missing candidate commit information as a pass.
- Allowing a background worker to own orchestration, acceptance, cleanup,
  merge, push, or lifecycle state.
- Using linkage to introduce schemas, CLI behavior, run-log fields,
  automation, product surfaces, or authority changes.

## Operator Workflow

An operator uses advisory linkage to find the relevant Samantha evidence faster:
the task spec path, run log path, run id, command, candidate commit, lifecycle
status, and final git status.

Before any acceptance decision, the operator independently reads the run log
and lifecycle evidence. Acceptance must be based on Samantha-owned evidence:
`HARNESS_RESULT`, changed-file scope, deterministic verification, candidate
commit, lifecycle record, and final git status.

The linkage can reduce navigation time, but it cannot make a run trusted.

## Slice D Manual Linkage Dogfood

Slice D manual linkage dogfood should check:

- whether linkage reduces navigation time
- whether pass/fail can be decided without thread summary
- whether already-applied TaskSpec or missing candidate commit is not mistaken
  for trusted pass
- whether runs:accept prerequisites are visible
- whether lifecycle completion plus final git status can be tracked

## Non-Goals

- Do not define a JSON schema.
- Do not define a formal data contract.
- Do not define CLI behavior.
- Do not define run-log fields.
- Do not define automation, scheduler, daemon, UI, MCP, or connector behavior.
- Do not change task specs, run logs, lifecycle records, direction documents,
  playbooks, lessons, implementation code, tests, package files, or operation
  artifacts.
- Do not make background thread state trusted evidence.

## Stop Conditions

Stop if the linkage artifact becomes a source of acceptance truth rather than
a pointer to Samantha-owned evidence.

Stop if thread summaries, streamed events, operator notes, or thread ids are
used to prove success.

Stop if any path would let a worker own orchestration, acceptance, merge,
cleanup, push, lifecycle transitions, policy, doctrine, or task-spec authority.

Stop if the design expands into schema work, CLI work, run-log field design,
automation planning, product surfaces, or authority changes outside the
reviewed slice.
