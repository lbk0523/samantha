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
- `ROADMAP.md`

## Work Rules

`WORK-RULES.md` is the source of truth for BK/Codex working discipline in this
repo: communication, thinking before coding, simplicity, surgical changes,
verification, completion, and next-action handoff rules.

Keep `AGENTS.md` focused on product boundaries, authority boundaries, and hard
gates. Add new work-discipline rules to `WORK-RULES.md` unless they are needed
here as a short routing or safety gate.

Before implementing Samantha self-build work, apply the relevant sections of
`WORK-RULES.md`. Before the final response, apply its completion checklist.

Mandatory final-response gate for Samantha self-build work:

- report deterministic verification and whether only intended files changed
- commit and push when safe, or state the stop condition that prevented it
- classify the outcome as completed now, recommended autonomous `/goal`, or
  blocked on BK decision
- prefer a ready-to-send `/goal` prompt for remaining autonomous engineering
  work, and use direct BK actions only for genuine BK decisions or blockers
- every ready-to-send `/goal` prompt must explicitly require Korean answers

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
