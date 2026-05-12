# Agent Harness Research

Last reviewed: 2026-05-13

## Purpose

This document records which open-source agent projects Samantha should learn
from, what to reject, and which experiments should come next.

Samantha's goal is not to become another general agent app. Samantha is a local
Codex development harness:

```text
minimal user goal
-> Samantha CEO planning
-> typed task spec
-> isolated worktree
-> Codex run
-> HARNESS_RESULT
-> deterministic verification
-> Samantha-owned commit/report
-> reviewed lessons
```

The useful question is therefore narrow:

> Which external projects help Samantha become a better governed development
> harness without pulling it back into remote, dashboard, chat-app, or broad
> multi-agent product scope?

## Executive Conclusion

Do not start by adopting a large agent framework.

The fastest path is to keep Samantha small and steal specific design pressure
from stronger projects:

- from `mini-swe-agent`: simple control flow, shell-first execution, linear
  trajectory, debug-friendly evidence
- from `Continue`: source-controlled AI rules/checks as repository artifacts
- from `Hermes Agent`: learning loop vocabulary, but not hidden memory or
  messaging gateways
- from `OpenHands` and `SWE-ReX`: sandbox/runtime separation, later
- from `LobeHub`: agent-as-unit-of-work product language, not architecture

The next implementation step is to add a report-only reviewer:

```text
report-only reviewer
```

`lessons:draft`, the initial task templates, and trajectory entries for the
current local run lifecycle are implemented. The remaining near-term gap is a
non-writer review role that can inspect evidence without gaining write,
merge, cleanup, or policy authority.

## High-Fit References

### mini-swe-agent

Source: https://github.com/SWE-agent/mini-swe-agent

Why it matters:

- It is intentionally minimal.
- It keeps agent history linear.
- It can operate with bash as the main tool surface.
- It treats trajectory as a first-class debugging/evaluation artifact.
- It is a better reference than the larger `SWE-agent` for Samantha's current
  stage.

What Samantha should copy conceptually:

- linear run trajectory
- append-only observations
- simple worker loop boundaries
- minimal configuration surface
- trajectory browser/inspection mindset

What Samantha should not copy now:

- Python implementation
- benchmark harness complexity
- broad model abstraction
- full SWE-bench workflow

Concrete Samantha experiments:

- Add a structured `trajectory` field to run logs.
- Record worker prompt, command invocation, stdout/stderr summary, result parse,
  verification commands, and lifecycle events as ordered entries.
- Make `runs:show` display a concise trajectory, not just final metadata.

### Continue

Source: https://github.com/continuedev/continue

Why it matters:

- It frames AI behavior as source-controlled project configuration.
- It points toward rules and checks living with the repository, not inside
  invisible assistant memory.
- It is useful for thinking about how Samantha can make agent behavior auditable
  and repeatable.

What Samantha should copy conceptually:

- repository-owned rules
- check definitions as files
- AI behavior shaped by committed artifacts
- CI-compatible evaluation mindset

What Samantha should not copy now:

- editor integration
- chat assistant UX
- broad provider configuration
- full AI coding assistant surface

Concrete Samantha experiments:

- Add `references/task-templates/*.json`.
- Add `references/playbooks/*.md`.
- Let task specs reference a playbook by id.
- Keep enforcement in TypeScript policy only when there is a focused test.

### OpenAI Codex

Source: https://github.com/openai/codex

Why it matters:

- Samantha's worker execution target is Codex.
- Codex already owns the actual coding-agent loop, local terminal execution, and
  model-facing behavior.
- Samantha should wrap Codex with contracts, isolation, verification, and
  reporting instead of rebuilding Codex internally.

What Samantha should copy conceptually:

- local terminal-first operation
- clear CLI invocation boundary
- respect for repo instructions such as `AGENTS.md`

What Samantha should not copy now:

- Codex internals
- model routing
- UI/app surfaces
- generalized coding assistant behavior

Concrete Samantha experiments:

- Keep `codex-dispatch` as a subprocess boundary.
- Improve evidence capture around Codex runs.
- Add compatibility tests for expected Codex output handling, not Codex internals.

## Medium-Fit References

### Hermes Agent

Source: https://github.com/NousResearch/hermes-agent

Why it matters:

- It directly targets self-improving agents.
- It has explicit concepts for skills, persistent memory, insights, and
  experience-based improvement.
- It validates the product intuition that repeated agent work should improve
  future behavior.

Why it is dangerous for Samantha:

- It is explicitly broad and personal-agent oriented.
- It includes messaging gateways and cross-session user memory.
- It optimizes for an agent that grows with the user, while Samantha needs
  governed, reviewable, repository-owned learning.

What Samantha should copy conceptually:

- learning loop pressure
- skill/playbook vocabulary
- prompting the system to persist useful procedural knowledge

What Samantha must reject:

- hidden memory
- automatic skill mutation
- messaging gateway scope
- remote/VPS operation
- broad personal assistant identity

Concrete Samantha experiments:

- `lessons:draft` writes candidates only.
- Lesson promotion is explicit and reviewable.
- Promoted lessons become markdown, task templates, agent profiles, or tested
  policy changes.

### OpenHands

Source: https://github.com/OpenHands/OpenHands

Why it matters:

- It is a mature open-source software-agent platform.
- It separates SDK, CLI, local GUI, cloud, and enterprise concerns.
- It has useful lessons around sandboxing, evaluation, and long-running agent
  runtime design.

Why it is too large now:

- Samantha is not a hosted agent platform.
- Samantha does not need a GUI, cloud product, marketplace, RBAC, or multi-user
  collaboration.
- Importing this shape too early would bury the core harness under product
  architecture.

What Samantha should copy conceptually later:

- separation between agent logic and runtime
- deterministic evaluation infrastructure
- sandbox abstraction vocabulary
- SDK/CLI boundary discipline

What Samantha should not copy now:

- GUI
- cloud
- integrations
- enterprise permission model
- broad autonomous agent platform scope

### SWE-ReX

Source: https://github.com/SWE-agent/SWE-ReX

Why it matters:

- It is a sandboxed shell runtime abstraction for AI agents.
- It cleanly separates agent logic from execution infrastructure.
- It supports local and remote backends, but Samantha only needs the local idea
  for now.

What Samantha should copy conceptually later:

- runtime adapter boundary
- shell session result model
- execution metadata
- sandbox interface tests

What Samantha should not copy now:

- remote execution
- cloud backends
- massive parallelism
- multi-session shell complexity

Concrete Samantha experiment later:

- Introduce a local-only `ExecutionRuntime` interface after current subprocess
  dispatch becomes painful.
- Keep it local-only until there is evidence that the abstraction pays for
  itself.

## Low-Fit Or Product-Vision References

### LobeHub

Source: https://github.com/lobehub/lobehub

Why it matters:

- It shares the language of agent teammates that grow with the user.
- It treats agents as the unit of work.
- It shows that agent-team UX is becoming a product category.

Why it is not an implementation foundation:

- It is a work/life agent product, not a narrow software harness.
- It is UI-heavy and ecosystem-heavy.
- It includes marketplace, plugins, remote database, multi-user, PWA/mobile, and
  general collaboration surfaces.

What Samantha should copy:

- product language around agent teams
- agent-as-unit-of-work framing
- human-agent co-evolution as a long-term product principle

What Samantha should reject:

- dashboard-first product shape
- marketplace/plugin expansion
- broad work/life assistant scope
- multi-user/productivity-suite direction

### Goose

Source: https://github.com/aaif-goose/goose

Why it matters:

- It is an extensible local AI agent that can install, execute, edit, and test
  with different LLMs.
- It is useful as a comparison point for tool extensibility and MCP usage.

Why it is not the foundation:

- Samantha already delegates coding to Codex.
- Samantha's value is governance around worker runs, not becoming another
  general coding agent.

Potential future use:

- Study its extension boundaries if Samantha eventually supports multiple
  worker engines.

### Aider, Cline, Roo Code, OpenCode

Representative sources:

- https://github.com/Aider-AI/aider
- https://github.com/cline/cline
- https://github.com/RooCodeInc/Roo-Code
- https://github.com/sst/opencode

Why they matter:

- They are strong examples of direct coding-agent UX.
- They show patterns for diffs, repo maps, terminal execution, editor flows, and
  user approval.

Why they are not the foundation:

- Samantha is not competing with coding agents.
- Samantha is a harness above a coding agent.
- Copying their UX would distract from task specs, isolation, verification, and
  Samantha-owned commits.

Potential future use:

- Treat some of them as optional worker engines only after the Codex-only harness
  is stable.

## Frameworks To Avoid For Now

### LangGraph

Source: https://github.com/langchain-ai/langgraph

LangGraph is valuable for durable graph-based agent workflows. Samantha does not
yet have a graph problem. Adding graph orchestration now would make the system
look more sophisticated while reducing understandability.

Use later only if:

- Samantha has real branching workflows.
- retries, pauses, reviews, and joins are painful in plain TypeScript.
- the graph state is still fully inspectable and testable.

### CrewAI

Source: https://github.com/crewAIInc/crewAI

CrewAI is built around role-playing autonomous agents. That is directionally
risky for Samantha because responsibility must remain explicit: Samantha owns
planning and integration; workers follow contracts.

Avoid until:

- Samantha has stable single-worker runs.
- specialist report-only roles are useful.
- role behavior is backed by typed task specs and policy tests.

### AutoGen

Source: https://github.com/microsoft/autogen

AutoGen is a major multi-agent framework, but the project itself currently
points new projects toward Microsoft Agent Framework. It is more useful as
history than as Samantha's foundation.

Do not adopt now.

## Design Principles Extracted For Samantha

### 1. Keep The Harness Above The Agent

Codex should write code. Samantha should decide:

- what task is allowed
- where it runs
- how result claims are parsed
- which checks are trusted
- whether the output can become a commit

If Samantha starts implementing a general coding agent, it is drifting.

### 2. Evidence Beats Agent Confidence

Every serious project converges on evidence:

- trajectory
- command output
- diff
- tests
- run metadata
- evaluation result

Samantha should invest here before adding more agent roles.

### 3. Learning Must Be Artifact Promotion

Hermes-style self-improvement is attractive, but Samantha needs a stricter
version:

```text
evidence -> candidate -> review -> committed artifact -> future behavior
```

No hidden memory. No automatic policy rewrite. No unreviewed authority changes.

### 4. Multi-Agent Comes After Single-Agent Discipline

The current trap is obvious: jump into CEO/manager/worker/reviewer/tester
orchestration before single-worker execution is excellent.

Samantha should add specialists in this order:

1. report-only reviewer
2. report-only test planner
3. writer worker with narrow task spec
4. parallel workers only when write sets are disjoint and merge policy is proven

### 5. Runtime Abstraction Should Follow Pain

SWE-ReX and OpenHands both show that runtime abstraction matters. Samantha
should not add it preemptively.

Current rule:

- subprocess Codex dispatch is enough
- local git worktrees are enough
- deterministic verification is enough

Introduce a runtime interface only when there are repeated failures around
execution capture, sandboxing, or process lifecycle.

## Recommended Next Experiments

### Experiment 1: Lesson Drafting

Implement:

```text
bun run samantha lessons:draft --run-log=<path>
```

It should:

- read one run log
- extract task id, run id, result, changed files, verify commands, lifecycle
  state, and failures
- write `references/lessons/inbox/<run-id>.md`
- classify the proposed lesson as one of:
  - playbook
  - task template
  - agent profile
  - policy/test
  - architecture doc
- never modify promoted artifacts directly

Why first:

- It uses existing run evidence.
- It is low-risk.
- It builds the self-learning loop without broad architecture.

Status:

- implemented
- covered by `tests/lesson-draft.test.ts`
- writes candidate markdown only
- does not modify promoted artifacts
- uses deterministic classification without LLM calls

### Experiment 2: Task Templates

Add:

```text
references/task-templates/docs-only.json
references/task-templates/core-module-with-tests.json
references/task-templates/cli-command-with-tests.json
```

Why second:

- Templates reduce repeated planning work.
- They make Samantha feel more like an organization with operating procedures.
- They stay inspectable and deterministic.

Status:

- implemented
- covered by `tests/task-template.test.ts`
- `tasks:from-template` can instantiate a template into
  `references/tasks/<task-id>.json`
- covered by `tests/task-from-template.test.ts`
- generated tasks are verified against the existing dispatch policy
- non-id placeholders remain visible for manual narrowing before dispatch

### Experiment 3: Trajectory Entries

Extend run logs with ordered entries:

```text
planned
worktree_created
worker_dispatched
worker_output_received
harness_result_parsed
verification_started
verification_finished
merge_checked
lifecycle_marked
cleanup_finished
```

Why third:

- It makes reports more credible.
- It gives lesson drafting better raw material.
- It prepares for reviewers without adding reviewers yet.

Status:

- implemented for the current local command surface
- worker run logs now include ordered trajectory entries for planning,
  worktree allocation, worker dispatch, worker output, HARNESS_RESULT parsing,
  and verification
- post-run commands append merge, lifecycle, and cleanup trajectory entries
- covered by `tests/run-log.test.ts` and `tests/post-run-trajectory.test.ts`

## Decision

Proceed with Samantha as a small Codex harness.

Do not adopt LobeHub, Hermes Agent, OpenHands, LangGraph, CrewAI, AutoGen, or
Goose as frameworks.

Use them as reference pressure only. The current implementation path is:

```text
lessons:draft [done]
-> task templates [done]
-> trajectory entries [done]
-> report-only reviewer [next]
-> local runtime abstraction only if needed
```
