# Samantha Roadmap

Last updated: 2026-05-13

## Purpose

This document is the phase-level product plan for Samantha.

It is not a PRD, implementation backlog, or active task queue. It should explain
which capability class comes next, why it matters, and which authority gates must
exist before the phase is considered done.

Execution still happens through task specs, run logs, lifecycle records, and
reviewed artifacts.

## Document Boundaries

- `NORTH_STAR.md` defines product identity and success.
- `ARCHITECTURE.md` defines system shape, authority boundaries, and gates.
- `LEARNING_ARCHITECTURE.md` defines explicit learning artifacts.
- `ROADMAP.md` sequences product capability phases.
- `references/tasks/*.json` are executable work units.
- `runs/*.json` and `runs/index.jsonl` are run evidence.

Do not use this roadmap to smuggle in broad backlog scope. When a phase is ready
for implementation, promote the smallest slice into a task spec with target
files, forbidden changes, and verification commands.

## Phase 0: Credible Local Harness

Status: current baseline.

User capability:

- BK can give a scoped software task.
- Samantha can dispatch a Codex worker in an isolated worktree.
- Samantha can parse `HARNESS_RESULT`, check scope, run verification, create a
  Samantha-owned commit, and record run evidence.
- Samantha can inspect runs, check mergeability, accept runs, clean up worktrees,
  diagnose failures, draft lesson candidates, and create task specs from
  templates or run evidence.

Required gates:

- writer cap stays one
- writer tasks declare target files, forbidden changes, and verify commands
- worker writes happen only in Samantha-allocated worktrees
- verification runs outside the worker's judgment
- run evidence is written locally
- merge, cleanup, policy, and doctrine transitions stay Samantha-owned

Acceptance evidence:

- `bun run typecheck`
- `bun test`
- passing writer run logs with Samantha-owned commits
- failed or out-of-scope run logs rejected without trusted commits

Non-goals:

- chat adapters
- daemon operation
- dashboards
- routine triggers
- budget governance
- multi-project orchestration
- parallel writer execution

## Phase 1: Evidence-Driven Recovery Loop

Status: implemented recovery baseline; further changes must stay evidence-led.

User capability:

- BK can point Samantha at a failed, blocked, stale, or incomplete run and get a
  concrete next action.
- Samantha can turn failure evidence into a narrower follow-up task without
  trusting failed worker output.
- Lifecycle state is visible enough that merge, accept, cleanup, and rework do
  not require manual reconstruction.

Required gates:

- failed worker output remains untrusted
- follow-up tasks cite run evidence and preserve relevant failed verification
- no hidden retry policy
- no automatic merge, cleanup, or push
- report-only runs remain evidence, not mergeable work

Acceptance evidence:

- `runs:diagnose` gives a clear classification for representative failed runs
- `tasks:from-run` refuses passing or superseded runs and creates bounded rework
  tasks for unresolved failures
- `runs:list` and `runs:show` expose enough lifecycle evidence to choose the next
  action without reading raw logs first
- focused tests cover each recovery class

Promotion rule:

Promote only concrete recovery gaps found in real run evidence. Do not add new
failure machinery because it might be useful later.

## Phase 2: Reviewable Learning Loop

Status: implemented baseline; high-cost failure promotion remains explicit, not
automatic.

User capability:

- Samantha can draft lesson candidates from run evidence.
- BK can review candidates before they become durable guidance or enforcement.
- Samantha can batch-review the lesson inbox, persist review decisions, promote
  recurrence-backed playbook candidates, and record later run evidence against
  promoted playbooks.
- Repeated failures can become playbooks. Templates, profile changes, policy
  checks, and direction-document updates remain candidate artifact classes that
  require explicit reviewed implementation.

Required gates:

- no hidden memory
- no automatic promotion
- lesson candidates must cite evidence
- policy lessons require focused tests
- doctrine updates stay documentation-only unless enforcement is explicitly
  requested

Acceptance evidence:

- `lessons:draft` produces a useful candidate from a representative run
- `lessons:review` records deterministic candidate reviews
- `lessons:review-inbox` produces a durable inbox review index
- `lessons:promote` promotes only explicit playbook promotion candidates
- `lessons:record-evidence` records whether later run evidence helped,
  hurt, or remained unclear
- promoted artifacts do not weaken worktree, scope, verification, or lifecycle
  gates

Promotion rule:

The implemented automatic signal marks playbook candidates for promotion only
after repeated evidence. Clear high-cost failures require explicit manual
review or a future deterministic signal before they can become an automatic
promotion path. A one-off annoyance should stay out of durable artifacts.

## Phase 3: Task Templates And Playbooks

Status: early templates exist; broader template growth should be evidence-led.

User capability:

- Samantha can create common task specs cheaply without losing explicit scope.
- BK can choose from proven task classes instead of re-explaining the same
  target files, forbidden changes, and verification commands.
- Advisory playbooks can guide repeated workflows without becoming hard gates.

Required gates:

- templates remain dispatch-safe
- generated task specs keep unresolved placeholders visible
- task specs must be narrowed before dispatch
- playbooks remain advisory unless a policy test turns them into gates

Acceptance evidence:

- real tasks repeatedly use each template successfully
- template tests prove dispatch safety
- at least one playbook captures repeated workflow knowledge without broadening
  worker authority

Promotion rule:

Create or revise templates only after real task usage shows repetition. Do not
template speculative work.

## Phase 4: Parallel Report-Only Review

Status: allowed by doctrine when Samantha owns orchestration; not a writer
parallelism shortcut.

User capability:

- Samantha can ask multiple non-writer reviewers to inspect evidence or plans in
  parallel.
- BK receives multiple reports as advice, not trusted state changes.

Required gates:

- reviewers use non-writer profiles
- `resultMode` is `report`
- no worktree allocation
- no setup or verify commands for report-only tasks unless a future policy
  deliberately changes that boundary
- no file writes, commits, merge, cleanup, lifecycle changes, or policy changes
- Samantha records report evidence and decides any follow-up task

Acceptance evidence:

- independent report-only runs complete without changed files
- Samantha can summarize multiple reports into a single decision point
- tests preserve report-only non-authority boundaries
- 2026-05-13 dogfood evidence: `2026-05-13T13-13-21-946Z-fixture-report-reviewer`
  and `2026-05-13T13-14-11-869Z-dogfood-report-reviewer` summarized as 2
  accepted reports, `advice-only`, `trustedStateChanges: false`, and a Samantha
  `review_reports` decision point
- 2026-05-13 explicit orchestration evidence:
  `2026-05-13T13-29-00-182Z-fixture-report-reviewer` and
  `2026-05-13T13-29-00-183Z-dogfood-report-reviewer` ran through
  `reports:orchestrate` and summarized as 2 accepted reports, `advice-only`,
  `trustedStateChanges: false`, and a Samantha `review_reports` decision point

Promotion rule:

Parallel report-only work may come before writer batching, but its output remains
evidence only.

## Phase 5: Speculative Writer Batches

Status: deferred until batch design exists.
Minimal contract draft: `references/batch-specs/phase-5-minimal-batch-spec.md`.

User capability:

- Samantha can run multiple isolated writer tasks as candidate commits and then
  integrate them in a Samantha-owned order.

Required gates:

- explicit batch id
- declared task dependencies
- known base commit for every worker worktree
- disjoint write-set checks before dispatch
- serial-only handling for contracts, policy, package metadata, lockfiles, task
  templates, agent profiles, and doctrine documents
- independent run logs and candidate commits per worker
- ordered Samantha merge queue
- focused verification after each accepted merge
- broader batch verification after final integration
- stale-base, rebase, partial failure, and cleanup policy

Acceptance evidence:

- batch artifacts prove dependency and write-set decisions before dispatch
- failed batch members do not contaminate accepted work
- every accepted writer output is reverified after integration
- cleanup/lifecycle evidence is recorded per worker

Promotion rule:

Do not start this phase by raising `writerCap`. Batch orchestration must exist
before writer parallelism becomes routine.

## Deferred Product Surfaces

These are not roadmap phases yet:

- chat or remote adapters
- daemon/watch operation
- dashboards
- routine triggers
- budget governance
- multi-project orchestration
- autonomous push or cleanup

Each surface needs its own reviewed product slice with authority, verification,
evidence, and lifecycle gates. None should re-enter as inherited migration scope.

## Roadmap Maintenance

Update this document only when a phase boundary, product capability, or
authority gate changes.

Do not use it for daily task tracking. Use run evidence, task specs, and
reviewed lesson artifacts for that.
