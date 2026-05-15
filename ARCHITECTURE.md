# Samantha Architecture

Last updated: 2026-05-15

## System Shape

Samantha is a local development harness organized around a CEO layer and
rule-bound worker layer.

```text
BK
-> Samantha CEO
-> task spec
-> dispatch policy
-> isolated worktree
-> Codex worker
-> HARNESS_RESULT
-> deterministic evaluation
-> Samantha-owned commit/report
-> run inspection, merge gate, cleanup, lifecycle evidence
```

## Design Tension

Samantha intentionally pays some speed cost to preserve trust, auditability, and
clear authority boundaries. That tradeoff should stay explicit as the harness
gets faster after the MVP.

The rule is:

```text
Reduce overhead by narrowing task classes, templates, and verification scope.
Do not reduce overhead by bypassing worker isolation, scope checks,
deterministic verification, run evidence, or Samantha-owned transitions.
```

Non-negotiable gates for writer output:

- Samantha allocates the worker worktree.
- The task declares target files and forbidden changes.
- Samantha checks changed files against scope outside the worker's judgment.
- Samantha runs deterministic verification outside the worker's judgment.
- Run evidence is recorded locally.
- Merge, cleanup, policy, and doctrine transitions stay Samantha-owned.

Efficiency should come from:

- report-only exploration before write work
- parallel report-only review when Samantha owns the orchestration
- reusable task templates
- cheaper verification that is still connected to the changed surface
- failure evidence that creates narrower follow-up tasks
- concise run summaries instead of broad UI or runtime scope

## Thin Harness, Fat Skills Interpretation

Samantha should stay a thin harness around strong model judgment and
deterministic local tooling.

The harness owns only the loop, file and worktree access, context routing,
dispatch boundaries, safety gates, verification, lifecycle records, and
Samantha-owned integration decisions. Judgment procedures belong in markdown
artifacts such as operating guides, work rules, playbooks, task templates, and
reviewed lessons. Trust decisions belong in deterministic code, policy checks,
scope checks, verification commands, and run evidence.

The rule is:

```text
Push judgment up into reviewable procedures.
Push trust down into deterministic checks.
Keep authority in Samantha-owned gates.
```

This interpretation does not grant new worker authority. "Fat skills" means
better reviewable procedures, not broader permissions. A playbook can guide
decomposition, diagnosis, synthesis, or next-action recommendation, but it
cannot make worker output trusted, bypass worktree isolation, accept a run,
merge, clean up, push, or rewrite policy.

Samantha should not import these adjacent patterns as v0 scope:

- automatic skill self-rewrite
- hidden memory
- cron, daemon, watch, or routine trigger behavior
- worker-owned orchestration
- resolver implementation that silently loads or mutates context without a
  reviewed artifact

## Context Resolver Principle

A resolver is a routing rule for context: when a task type, intent, or artifact
surface appears, load the relevant document or playbook before deciding. Skills
and playbooks say how to reason. Resolver rules say what context to read when.

For now, Samantha's resolver should remain a documented routing principle, not
a new runtime system. Repeated evidence may justify a future resolver artifact
or deterministic resolver code, but that promotion must be reviewed like any
other learning or policy change.

Current routing examples:

- `brainstorm` intent reads `OPERATING_GUIDE_KR.md` and
  `references/playbooks/samantha-brainstorming.md`.
- `doctrine-update` work reads `AGENTS.md`, `NORTH_STAR.md`,
  `ARCHITECTURE.md`, `ROADMAP.md`, and `WORK-RULES.md` as relevant to the
  proposed boundary.
- `policy-change` work reads `ARCHITECTURE.md`, `src/core/policy.ts`,
  `tests/policy.test.ts`, and the task templates or profiles whose authority
  would change.
- failed-run recovery reads the source run log, run diagnosis behavior, and
  task-from-run rules before producing a follow-up task.

Resolver rules must reduce context bloat. Do not move every lesson, quirk, or
preference into `AGENTS.md`; keep top-level documents as pointers to narrower
artifacts and load the narrower artifact only when it matters.

## Task Classes / Execution Modes

Samantha should not model cheap work as a weaker safety mode. Cheap work should
be represented as a narrower task class with a narrower verification surface.

The current contracts encode these classes through task templates, agent
profiles, `resultMode`, worktree policy, and merge policy. A future explicit
`task.kind` field is acceptable only if real usage proves the template/profile
encoding is too implicit.

| Class | Authority | Worktree | Verification | Use |
| --- | --- | --- | --- | --- |
| report-only exploration | read and report only | none | no setup or verify commands in current policy; summary is advice-only evidence | reviews, evidence synthesis, architecture critique, run inspection |
| docs-only writer | markdown writes only | per-task | cheap deterministic document-surface checks | direction docs, playbooks, lesson candidates, reviewed documentation |
| standard writer task | bounded source/test writes | per-task | focused tests plus broader sanity when justified | normal implementation work |
| rework task | bounded follow-up writes | per-task | starts from the failed command or scope evidence | fixing a failed run without trusting failed worker judgment |
| policy-change | authority or contract writes | per-task | focused policy/template tests required | `src/core/policy.ts`, contracts, profiles, templates, or enforcement changes |
| doctrine-update | product direction writes | per-task | docs verification plus report-only review when authority boundaries move | `AGENTS.md`, `NORTH_STAR.md`, `ARCHITECTURE.md`, `ROADMAP.md` |

The forbidden post-MVP shortcut is a "light" writer task that skips isolation,
scope checks, deterministic verification, or evidence recording. A small task
may have a small verify command, but it still has a verify command.

## Parallelism Boundary

Single-writer execution is an MVP constraint, not permanent product doctrine.
Samantha should eventually support larger work by running multiple agents, but
parallelism must not blur authority or make unverified output trusted.

The rule is:

```text
Parallel execution can arrive before parallel trust.
Integration stays ordered, Samantha-owned, and reverified.
```

The intended evolution is:

1. Parallel report-only workers.
   Non-writer reviewers, researchers, and spec workers may scale first because
   they have `resultMode: "report"`, no worktree allocation, no merge policy,
   and no lifecycle authority. Their output is advice and evidence, not trusted
   writes.
2. Speculative writer batches.
   Multiple writer tasks may later run in isolated worktrees at the same time,
   but only as candidate commits. Samantha must still choose the merge order and
   re-run verification after each accepted integration step.
3. Batch orchestration.
   Large work needs explicit batch artifacts, task dependencies, partial failure
   handling, ordered merge gates, batch-level summaries, and cleanup/lifecycle
   evidence.

Parallel writer batches require at least:

- a batch id and declared task dependencies
- a known base commit for every worker worktree
- disjoint target files and forbidden changes checked before dispatch
- serial-only handling for shared files such as contracts, policy, package
  metadata, lockfiles, task templates, agent profiles, and doctrine documents
- independent run logs and candidate commits per worker
- an ordered Samantha merge queue
- focused verification after each accepted merge
- broader batch verification after the final accepted merge
- stale-base `block_and_replan` evidence that does not mutate the source
  `BatchSpec`
- stale-base, rebase, reverify, partial failure, and cleanup policy

Until those pieces exist, writer execution and integration stay serial. Worker
owned subagent orchestration stays forbidden; Samantha owns orchestration.

## Meta-Task Rules

Meta-tasks change Samantha's own rules rather than ordinary product behavior.
They need stricter evidence because they can alter future authority.

Treat these as doctrine or policy tasks:

- `AGENTS.md`
- `NORTH_STAR.md`
- `ARCHITECTURE.md`
- `ROADMAP.md`
- `src/core/policy.ts`
- task templates
- agent profiles
- contract types that grant or restrict authority

Doctrine updates should stay documentation-only unless the task explicitly
includes an enforcement change. Policy changes need focused tests that prove the
new rule accepts and rejects the intended cases. Changes that move authority
boundaries should also receive a report-only review before becoming routine.

## Layers

### 1. CEO Layer

The CEO layer is the planning and accountability surface.

It is allowed to:

- discuss goals with BK
- decompose work
- choose sequence and scope
- decide when to ask clarifying questions
- produce reports
- propose changes to harness rules

It is not allowed to bypass deterministic gates. When work becomes executable,
it must become task specs, policies, and verification commands.

### 2. Contract Layer

The contract layer defines the vocabulary of work.

Current files:

- `src/core/contracts.ts`
- `references/agent-profiles/codex-worker.json`
- `references/agent-profiles/codex-reviewer.json`
- `references/tasks/fixture-single-writer.json`
- `references/tasks/fixture-report-reviewer.json`

Contracts describe:

- task identity
- target agent
- target files
- forbidden changes
- setup commands
- verify commands
- result mode
- expected commit subject

### 3. Policy Layer

The policy layer decides whether a task may be dispatched.

Current files:

- `src/core/policy.ts`
- `tests/policy.test.ts`

Current policy:

- writer cap is one
- writer tasks must declare target files
- writer tasks must declare forbidden changes
- writer tasks must declare verify commands
- non-writer tasks must be report-only
- non-writer report tasks must not declare setup commands
- orchestration-conflicting skills are blocked

### 4. Worktree Layer

The worktree layer isolates writes.

Current files:

- `src/core/git.ts`
- `src/core/worktree.ts`
- `tests/worktree.test.ts`

Current behavior:

- allocate per-task worktrees
- reuse only clean matching worktrees
- reject dirty or mismatched worktrees
- keep workers away from the target repo worktree

### 5. Dispatch Layer

The dispatch layer prepares the worker prompt and command.

Current files:

- `src/core/codex-dispatch.ts`
- `src/core/worker-dispatch.ts`
- `tests/codex-dispatch.test.ts`
- `tests/worker-dispatch.test.ts`

Current behavior:

- build a scoped Codex prompt
- include target files, forbidden changes, setup context, verify commands, and
  final `HARNESS_RESULT` requirements
- run non-writer report tasks in a read-only Codex sandbox without allocating a
  worker worktree
- run setup commands before Codex for writer tasks
- execute the Codex command
- evaluate output
- create the Samantha-owned commit only after gates pass

### 6. Evaluation Layer

The evaluation layer judges worker output.

Current files:

- `src/core/harness-result.ts`
- `src/core/worker-result.ts`
- `src/core/run-commit.ts`
- `src/core/glob.ts`
- `tests/harness-result.test.ts`
- `tests/worker-result.test.ts`
- `tests/run-commit.test.ts`

Current behavior:

- parse `HARNESS_RESULT`
- reject missing or malformed structured results
- read committed and uncommitted changed files
- reject out-of-scope changes
- reject forbidden changes
- run every verify command
- pass only when harness status, scope, and verification all pass

### Verify Quality Doctrine

The policy requirement is not merely "some verify command exists." Verification
should be connected to the changed surface and the task's risk.

Template defaults should follow this order:

- focused verification for the specific behavior or document surface
- broader repository sanity checks only when the change can plausibly affect
  shared contracts or executable behavior
- no mutation testing until repeated evidence shows weak verification is a
  recurring failure class

Examples:

- source changes should include focused tests for the changed module or command
  and usually a full test/typecheck sanity pass
- policy or contract changes should include tests that prove both allowed and
  rejected cases
- docs-only changes should use cheap deterministic checks tied to markdown
  changes; full typecheck/test is optional evidence, not the default cost

### 7. Evidence Layer

The evidence layer records what happened.

Current files:

- `src/core/run-log.ts`
- `src/core/post-run-trajectory.ts`
- `src/core/ledger.ts`
- `src/core/run-list.ts`
- `src/core/run-show.ts`
- `src/core/run-diagnose.ts`
- `tests/run-log.test.ts`
- `tests/post-run-trajectory.test.ts`
- `tests/ledger.test.ts`
- `tests/run-list.test.ts`
- `tests/run-show.test.ts`
- `tests/run-diagnose.test.ts`

Current behavior:

- write JSON run logs under `runs/`
- record ordered worker trajectory entries in run logs
- append merge, lifecycle, and cleanup trajectory entries from post-run commands
- append compact run summaries to `runs/index.jsonl`
- support `runs:list`
- support `runs:show`

## Failure Recovery Model

Samantha should not make failed worker output trustworthy by retrying inside the
same authority context. A failed run is evidence. The normal recovery path is:

```text
failed run evidence
-> classify failure
-> create a narrower follow-up task or lifecycle action
-> run through the same gates again
```

Current run summaries already classify setup failures, worker command failures,
malformed results, scope violations, verification failures, commit failures, and
blocked/rework harness results. Commands such as `runs:diagnose` or future
`tasks:from-run` should use that evidence to produce the next explicit artifact
instead of adding automatic hidden retry policy.

Allowed recovery actions:

- setup failure: fix setup instructions or environment, then run a new task
- worker command failure: rerun only if the failure is clearly transient;
  otherwise create a rework task from the evidence
- missing or malformed `HARNESS_RESULT`: reject the run and tighten the task or
  worker prompt before rerunning
- scope violation or forbidden change: reject the run, split or narrow the task,
  and keep the violating output untrusted
- verify failure: create a rework task that cites the failed command and keeps
  that command in verification
- stale base, dirty target repo, missing commit, or cleanup blocker: handle as
  an explicit merge/lifecycle operation, not as worker authority

Automatic retry can be considered later only when it is visible in run evidence,
bounded by policy, and cannot accept unverified worker output.

### 8. Integration Gate Layer

The integration gate layer checks whether a worker result may be integrated.

Current files:

- `src/core/merge-gate.ts`
- `tests/merge-gate.test.ts`

Current behavior:

- classify mergeable runs
- detect already-merged runs
- detect stale base commits
- detect dirty target repos
- detect failed verification
- detect missing commits
- produce a fast-forward merge command without applying it

### 9. Lifecycle Layer

The lifecycle layer tracks explicit post-run transitions.

Current files:

- `src/core/run-accept.ts`
- `src/core/run-lifecycle-store.ts`
- `src/core/worktree-cleanup.ts`
- `tests/run-accept.test.ts`
- `tests/run-lifecycle-store.test.ts`
- `tests/worktree-cleanup.test.ts`

Current behavior:

- mark explicit merge and cleanup events
- remove completed worker worktrees only after the worker commit is integrated
- delete merged worker branches
- block cleanup for dirty, missing, unintegrated, or unsafe worktrees

### 10. Learning Artifact Layer

The learning artifact layer turns run evidence into explicit, reviewable
repository artifacts.

Learning is a pipeline:

```text
run evidence
-> lesson candidate
-> review
-> promoted artifact
-> enforcement or guidance
-> later run evidence
```

Nothing becomes durable guidance until it is promoted into a repository
artifact. Samantha must not learn through hidden memory, vague preference drift,
automatic policy rewrite, or unreviewed authority changes.

Current files:

- `src/core/lesson-draft.ts`
- `src/core/lesson-inbox-review.ts`
- `src/core/lesson-promote.ts`
- `src/core/lesson-review.ts`
- `src/core/task-family.ts`
- `src/core/task-from-template.ts`
- `src/core/task-from-run.ts`
- `references/task-templates/docs-only.json`
- `references/task-templates/core-module-with-tests.json`
- `references/task-templates/cli-command-with-tests.json`
- `references/task-templates/report-only-review.json`
- `tests/lesson-draft.test.ts`
- `tests/lesson-inbox-review.test.ts`
- `tests/lesson-promote.test.ts`
- `tests/lesson-review.test.ts`
- `tests/playbook-evidence.test.ts`
- `tests/task-template.test.ts`
- `tests/task-from-template.test.ts`
- `tests/task-from-run.test.ts`

Current behavior:

- draft markdown lesson candidates under `references/lessons/inbox/`
- classify lesson candidates deterministically without LLM calls
- include task-family recurrence evidence in lesson candidates
- record reviewed candidate artifacts under `references/lessons/reviews/`
- batch-review inbox candidates and write a review index
- classify stale or no-promotion candidates as auto-rejected
- keep one-off playbook candidates as needs-more-evidence
- mark recurring playbook candidates as promotion candidates after the threshold
- keep promoted artifacts unchanged during lesson drafting
- promote only explicit playbook promotion candidates through `lessons:promote`
- append later run evidence to promoted playbooks through `lessons:record-evidence`
- store task template shapes as source-controlled JSON artifacts
- create task specs from templates by replacing task id, title, and explicit
  `--set=<placeholder>:<value>` substitutions
- keep unresolved placeholders visible for manual narrowing and report their
  names after generation
- refuse to overwrite existing task specs

Allowed learning artifacts are markdown direction documents, playbooks, task
templates, agent profiles, TypeScript policy checks with tests, run summaries,
lifecycle records, lesson candidates, and lesson reviews.

Promotion force should stay proportional to evidence:

- advisory lessons live in playbooks
- default behavior lives in task templates or agent profiles
- gates live in TypeScript policy and focused tests
- doctrine lives in `AGENTS.md`, `NORTH_STAR.md`, `ARCHITECTURE.md`, or
  `ROADMAP.md`

Playbooks should be treated as method calls, not loose advice piles. A durable
playbook should make its invocation shape clear:

- when to use it
- required inputs
- procedure
- output shape
- evidence or verification expectations
- authority limits

The invocation supplies the concrete repo, task, run log, question, or evidence
set. The playbook supplies the repeatable judgment procedure. If a playbook is
only useful after adding hidden assumptions, it is not ready to guide worker or
Samantha behavior.

Workers do not learn directly. Worker behavior changes only when Samantha
updates the task instructions, agent profile, blocked skills, target files,
forbidden changes, verify commands, or playbook references that workers receive.
Agent profiles may guide worker behavior, but they cannot grant authority that
policy rejects.

Learning must never create background execution, grant worker merge/push/cleanup
authority, bypass deterministic verification, store secrets, hide user
preferences in opaque memory, or silently rewrite doctrine or policy. The bias
is slow promotion and strong evidence.

## CLI Surface

Current files:

- `src/cli.ts`
- `src/commands/run-task.ts`
- `tests/cli.test.ts`

Current command surface:

```bash
bun run samantha run-task <task.json> --repo-root=<repo>
bun run samantha runs:list
bun run samantha runs:show <run-id>
bun run samantha merge:check --run-log=<path> --repo-root=<repo>
bun run samantha runs:mark-lifecycle --run-log=<path> --repo-root=<repo> --event=merged|cleaned
bun run samantha worktree:cleanup --run-log=<path> --repo-root=<repo>
bun run samantha runs:accept --run-log=<path> --repo-root=<repo>
bun run samantha runs:diagnose --run-log=<path>
bun run samantha lessons:draft --run-log=<path>
bun run samantha lessons:review <candidate.md>
bun run samantha lessons:review-inbox [--repo-root=<repo>]
bun run samantha lessons:promote <candidate.md> --playbook-id=<id>
bun run samantha lessons:record-evidence <playbook.md> --run-log=<path> --assessment=helped|not-helped|unclear --note=<note>
bun run samantha tasks:from-template <template-id> --task-id=<id> --title=<title> [--set=<placeholder>:<value>]...
bun run samantha tasks:from-run --run-log=<path> --task-id=<id> --title=<title>
```

The CLI currently stays local and explicit. Remote adapters, daemon operation,
or chat command surfaces require separate product design and authority gates;
they should not be inherited from historical migration scope.

## Responsibility Model

Samantha owns transitions. Workers own only bounded task execution.

The system should preserve this invariant:

```text
No worker output becomes trusted work until Samantha verifies scope,
verification, and lifecycle gates outside the worker's judgment.
```

## Architectural Pressure To Resist

Avoid these shortcuts:

- turning reports into hidden memory
- letting workers commit directly to target branches
- allowing worker-created worktrees
- adopting broad agent frameworks before repeated local evidence proves the
  abstraction is worth its authority and maintenance cost
- adding remote or chat control without explicit product and authority design
- building dashboards before run logs and summaries are stable
- letting workers orchestrate subagents or parallel writers
- adding parallel writer batches before batch gates, ordered integration, and
  post-merge verification exist

External agent projects should be reference pressure, not product scope. Do not
adopt LobeHub, Hermes Agent, OpenHands, LangGraph, CrewAI, AutoGen, Goose, or a
runtime abstraction as Samantha's framework by default. Keep subprocess Codex
dispatch, local git worktrees, and deterministic verification until repeated
failures show the current boundary is the problem.
