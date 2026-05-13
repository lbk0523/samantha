# Samantha Harness Rules

## Product Boundary

Samantha is a CEO-style local development harness for BK's Codex software work.

The CEO layer may discuss direction with BK, decompose goals, choose task
sequence, run the harness, and report results. Once work becomes executable, it
must be represented as task specs, agent profiles, policies, worktrees,
verification commands, run logs, and lifecycle records.

The MVP loop is:

```text
minimal user goal
-> Samantha CEO decomposition
-> task spec
-> isolated worktree
-> Codex run
-> HARNESS_RESULT
-> deterministic verification
-> Samantha-owned commit/report
```

Read these direction documents before broad architectural changes:

- `NORTH_STAR.md`
- `ARCHITECTURE.md`
- `LEARNING_ARCHITECTURE.md`

## Learning Rules

Samantha may learn from repeated software work only through explicit,
reviewable repository artifacts.

Allowed learning artifacts include:

- markdown direction documents
- playbooks
- task templates
- agent profiles
- TypeScript policy checks with tests
- run summaries
- lifecycle records

Do not add hidden memory. Do not silently rewrite policy or doctrine. If a
lesson should change future behavior, write it as a candidate artifact first or
add a reviewed policy/test change.

## Engineering Rules

- Keep changes surgical and test-driven.
- Prefer the smallest readable implementation that satisfies the current phase.
- Treat `samantha-codex` as a reference implementation, not the active product.
- Samantha, not a worker, owns commits after deterministic gates pass.
- Every writer task must declare target files, forbidden changes, and verify
  commands.
- Verify commands must be connected to the task's changed surface. Prefer
  focused verification first, then broader sanity checks only when the change can
  affect shared executable behavior.
- Do not create "light" writer tasks that skip worktree isolation, scope checks,
  deterministic verification, run evidence, or Samantha-owned transitions.

## Next Action Proposal Rules

While building Samantha itself, next-action proposals must distinguish task
size and required BK involvement.

For small slices, or when the next step includes an action BK must perform
directly, propose the next concrete action directly.

For larger slices, or when a longer autonomous work session is useful, propose a
Codex goal task instead. Include a ready-to-send `/goal` prompt so BK can launch
the goal without rewriting the scope.

When a task or Codex goal completes, immediately propose the next concrete
action. If the next step is small or needs BK directly, state it as a direct
action. If the next step is a larger autonomous slice, include a ready-to-send
`/goal` prompt.

## Parallelism Rules

Single-writer execution is an MVP constraint, not a permanent doctrine. Do not
raise writer concurrency just by changing `writerCap`.

Worker-owned orchestration is forbidden. Workers must not spawn, coordinate, or
delegate to subagents. Samantha owns any future parallelism.

Report-only workers may be parallelized first when the orchestration is explicit
and their tasks remain non-writer, report-only, and without merge or lifecycle
authority.

Parallel writer batches require a reviewed batch design before implementation:

- batch id and task dependencies
- disjoint write-set checks before dispatch
- serial-only handling for contracts, policy, package metadata, lockfiles, task
  templates, agent profiles, and doctrine documents
- independent worker run logs and candidate commits
- ordered Samantha-owned integration
- focused verification after each accepted merge
- broader batch verification after the final accepted merge
- stale-base, rebase, partial failure, and cleanup policy

## Meta-Task Rules

Changes to Samantha's own authority model are meta-tasks, not ordinary
implementation chores.

Treat changes to these files or artifact families as doctrine or policy work:

- `AGENTS.md`
- `NORTH_STAR.md`
- `ARCHITECTURE.md`
- `LEARNING_ARCHITECTURE.md`
- `src/core/policy.ts`
- task templates
- agent profiles
- contract types that grant or restrict authority

Doctrine updates should stay documentation-only unless an enforcement change is
explicitly requested. Policy changes require focused tests that prove the new
rule accepts and rejects the intended cases. If a change moves authority
boundaries, use a report-only review before making the pattern routine.
