# Samantha Architecture

Last updated: 2026-05-13

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
- run setup commands before Codex
- execute the Codex command
- evaluate output
- create the Samantha-owned commit only after gates pass

### 6. Evaluation Layer

The evaluation layer judges worker output.

Current files:

- `src/core/harness-result.ts`
- `src/core/worker-result.ts`
- `src/core/glob.ts`
- `tests/harness-result.test.ts`
- `tests/worker-result.test.ts`

Current behavior:

- parse `HARNESS_RESULT`
- reject missing or malformed structured results
- read committed and uncommitted changed files
- reject out-of-scope changes
- reject forbidden changes
- run every verify command
- pass only when harness status, scope, and verification all pass

### 7. Evidence Layer

The evidence layer records what happened.

Current files:

- `src/core/run-log.ts`
- `src/core/post-run-trajectory.ts`
- `src/core/ledger.ts`
- `tests/run-log.test.ts`
- `tests/post-run-trajectory.test.ts`
- `tests/ledger.test.ts`

Current behavior:

- write JSON run logs under `runs/`
- record ordered worker trajectory entries in run logs
- append merge, lifecycle, and cleanup trajectory entries from post-run commands
- append compact run summaries to `runs/index.jsonl`
- support `runs:list`
- support `runs:show`

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

- `src/core/run-lifecycle-store.ts`
- `src/core/worktree-cleanup.ts`
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

Current files:

- `src/core/lesson-draft.ts`
- `src/core/task-from-template.ts`
- `references/task-templates/docs-only.json`
- `references/task-templates/core-module-with-tests.json`
- `references/task-templates/cli-command-with-tests.json`
- `references/task-templates/report-only-review.json`
- `tests/lesson-draft.test.ts`
- `tests/task-template.test.ts`
- `tests/task-from-template.test.ts`

Current behavior:

- draft markdown lesson candidates under `references/lessons/inbox/`
- classify lesson candidates deterministically without LLM calls
- keep promoted artifacts unchanged during lesson drafting
- store task template shapes as source-controlled JSON artifacts
- create task specs from templates by replacing only task id and title
- keep non-id placeholders visible for manual narrowing
- refuse to overwrite existing task specs

## CLI Surface

Current command surface:

```bash
bun run samantha run-task <task.json> --repo-root=<repo>
bun run samantha runs:list
bun run samantha runs:show <run-id>
bun run samantha merge:check --run-log=<path> --repo-root=<repo>
bun run samantha runs:mark-lifecycle --run-log=<path> --repo-root=<repo> --event=merged|cleaned
bun run samantha worktree:cleanup --run-log=<path> --repo-root=<repo>
bun run samantha lessons:draft --run-log=<path>
bun run samantha tasks:from-template <template-id> --task-id=<id> --title=<title>
```

The CLI should stay local and explicit. It should not become a daemon, remote
adapter, or chat command system.

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
- adding remote/Telegram control before local usefulness is proven
- building dashboards before run logs and summaries are stable
- adding multi-agent orchestration before single-writer discipline is boring
