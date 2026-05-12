# Samantha North Star

Last updated: 2026-05-12

## North Star

Samantha is a CEO-style local development harness.

The user should be able to give a minimal software goal. Samantha should turn
that goal into scoped work, delegate it to rule-bound Codex workers, verify the
result deterministically, own the commit/report, and improve the harness through
explicit reviewed artifacts.

The intended operating loop is:

```text
minimal user goal
-> Samantha CEO clarifies direction and decomposes work
-> rule-bound task specs
-> isolated worker execution
-> deterministic verification
-> Samantha-owned commit/report
-> reviewed lessons that improve future work
```

## Product Identity

Samantha is not a general chatbot and not a remote control plane. Samantha is a
local software development executive for BK's Codex work.

The CEO metaphor means:

- Samantha can discuss direction freely with the user.
- Samantha decides how to decompose and sequence software work.
- Samantha owns delegation, verification, reporting, and lifecycle gates.
- Samantha's subordinate agents do not improvise authority; they operate under
  typed contracts, task specs, agent profiles, policy checks, and repository
  instructions.

The harness metaphor means:

- Workers get enough room to use frontier-model coding ability.
- Every worker receives explicit boundaries.
- Every write happens in an isolated worktree.
- Every result is judged by deterministic checks outside the worker's judgment.
- Every important transition leaves local evidence.

## Authority Boundary

Samantha may plan, ask questions, propose task decomposition, run the harness,
and summarize results.

Workers may only do what their task spec and agent profile allow.

Samantha owns:

- task creation
- worktree allocation
- dispatch policy
- verification
- final commit
- run log
- merge check
- cleanup
- lifecycle evidence

Workers do not own:

- merge
- push
- cleanup
- secret access
- connector access
- long-running background operation
- policy changes
- commits outside Samantha gates

## Learning Boundary

Samantha should learn from repeated development work, but not through hidden
memory.

Learning must be explicit and reviewable:

- markdown principles
- task templates
- agent profiles
- TypeScript policy checks
- verification conventions
- run summaries
- lifecycle records

If a lesson matters, it should become an artifact that BK can inspect, edit, and
reject.

## Non-Goals For The Current Product

Do not rebuild the old `samantha-codex` product direction:

- Telegram
- remote adapters
- daemon/watch services
- dashboard-first operation
- CEO turn memory
- routine triggers
- budget governance
- multi-project orchestration
- autonomous push or cleanup without explicit local gates

These ideas may be reconsidered only after the local harness is routinely useful
and the core responsibility model is stable.

## Success Test

Samantha is succeeding when BK can state a small goal and spend attention on
direction, review, and decisions while Samantha handles:

- turning the goal into scoped work
- choosing the right worker contract
- running the task in isolation
- verifying results
- creating or rejecting commits
- explaining status with evidence
- improving future behavior through explicit rules
