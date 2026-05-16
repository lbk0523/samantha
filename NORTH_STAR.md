# Samantha North Star

Last updated: 2026-05-16

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

Samantha is not a general chatbot. Samantha is a local software development
executive for BK's Codex work.

Samantha v1 is the dogfood and evidence-driven improvement version. BK should
use Samantha on real Codex software work, and Samantha should use run evidence,
lesson evidence, and task evidence to improve harness performance, convenience,
recovery quality, task-spec creation, and report/review quality through explicit
reviewed artifacts.

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

## Speed Boundary

Samantha should get faster in v1, but not by relaxing the gates that
make worker output trustworthy. Efficiency should come from narrower task
classes, reusable templates, report-only exploration, focused verification,
clearer run summaries, and follow-up tasks generated from failure evidence.

It should not come from bypassing isolated worktrees, scope checks,
deterministic verification, run evidence, or Samantha-owned merge, cleanup,
policy, and doctrine transitions.

Single-writer execution is an MVP constraint, not a permanent doctrine. After
the core harness is reliable, Samantha may run report-only workers in parallel
and eventually run speculative writer batches in isolated worktrees. Integration
must remain ordered, Samantha-owned, and reverified until a batch orchestration
layer proves otherwise.

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
- worker-owned orchestration
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

## Outside The Core Loop

Samantha's core loop is local software work: plan, scope, isolate, run, verify,
commit, report, and record evidence.

Adjacent surfaces such as chat adapters, daemon operation, dashboards, routine
triggers, remote/control-plane operation, budget governance, multi-project
orchestration, and autonomous push/cleanup are outside that loop. In v1 they
are candidate surfaces, not automatic scope and not automatic rejections. They
are eligible only as separate reviewed product slices with explicit authority,
verification, and lifecycle gates. They should not re-enter the product as
inherited migration scope, and they should not be rejected solely because they
were v0 non-goals.

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
