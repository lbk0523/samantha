# Samantha Roadmap

Last updated: 2026-05-24

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
- `ROADMAP.md` sequences product capability phases.
- `references/tasks/*.json` are executable work units.
- `runs/*.json` and `runs/index.jsonl` are run evidence.

Do not use this roadmap to smuggle in broad backlog scope. When a phase is ready
for implementation, promote the smallest slice into a task spec with target
files, forbidden changes, and verification commands.

## Version Boundary: v1

Samantha v1 is the dogfood and evidence-driven improvement version. The goal is
to use Samantha on real Codex work, accumulate run evidence, lesson evidence,
and task evidence, and improve harness performance and convenience through
explicit reviewed artifacts.

Phase 0 is the credible local harness baseline. v1 starts from that baseline and
prioritizes recovery quality, reviewable learning, task-spec convenience,
report/review quality, focused verification, and clearer run summaries.

Surfaces such as background operation, operator UIs, scheduled automation,
messaging or remote-control integrations, budget governance, and multi-project
orchestration are not automatic scope. They should not be rejected solely
because older slices excluded them, but each needs its own reviewed product
slice with authority, verification, evidence, and lifecycle gates.

## Phase 0: Credible Local Harness

Status: v0 baseline completed; retained as the v1 trust baseline.

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

Deferred from the Phase 0 baseline:

- messaging integrations
- background/watch operation
- operator UIs
- scheduled automation
- budget governance
- multi-project orchestration
- parallel writer execution

In v1, these are not automatic rejections. They remain out of the Phase 0
baseline and require separate reviewed product slices before implementation.

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
- worker behavior changes only through reviewed artifacts that workers receive

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

Future autonomy ladder:

1. Current baseline: automatic candidate drafting and deterministic inbox review
   are allowed, while promotion remains explicit.
2. Prioritized review: Samantha may rank promotion candidates, explain why each
   candidate should be promoted, rejected, or held for more evidence, and reduce
   BK review to the highest-signal decisions.
3. Shadow autopromotion: Samantha records non-mutating promotion decisions and
   compares them with BK's later choices before any authority expands.
4. Limited advisory autopromotion: recurring, low-risk playbook guidance may be
   auto-promoted only with repeated evidence, deterministic review, audit
   records, and rollback.
5. Supervised high-risk learning: task templates, agent profiles, policy checks,
   verification defaults, and doctrine remain review-required until a separate
   architecture slice proves narrower authority with tests and lifecycle
   evidence.

This ladder is future direction, not current authority. Phase 2 still forbids
automatic promotion into durable guidance.

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
- Drift Review Slice A exists as a one-shot report-only product slice through
  `references/playbooks/drift-review.md` and
  `references/task-templates/drift-review.json`
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

Status: BatchSpec planning, preflight, execution, ordered integration,
verification, stale-base replan evidence, cleanup evidence, explicit
Samantha-owned source BatchSpec rejection, and explicit stale-base replacement
BatchSpec generation baseline implemented.

Design artifacts:

- Minimal contract and preflight design:
  `references/batch-specs/phase-5-minimal-batch-spec.md`
- Writer batch execution design draft:
  `references/batch-specs/phase-5-writer-batch-execution-design.md`

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

Implemented planning gates:

- BatchSpec artifact store and stable `batchId` lookup
- path and id preflight
- referenced TaskSpec parsing and declaration matching
- write-set and forbidden-change preflight
- serial-only classification and single-member serial dispatch groups
- git `baseCommit` resolution and target `HEAD` equality gate
- verification and lifecycle policy contract validation
- CLI preflight that reports whether a batch may dispatch

Implemented execution gates:

- `batches:execute` re-runs preflight immediately before dispatch
- eligible dispatch groups run writer tasks from the BatchSpec `baseCommit`
- each worker records an independent run log and candidate commit evidence
- dependency failures block dependents while independent candidates can proceed
- serial-only authority-boundary changes are blocked from the routine writer
  batch path and require a separate doctrine or policy task
- integration follows `integrationQueue` order and is Samantha-owned
- focused verification runs after each accepted candidate integration
- final batch verification runs after the last accepted candidate
- stale `baseCommit` is blocked by preflight, and unexpected target `HEAD`
  movement during integration is treated as `block_and_replan`
- stale-base closure records Samantha-owned terminal replan evidence in
  `batch-replan-evidence.jsonl` without mutating the source `BatchSpec`
- stale-base replacement planning is explicit-only through Samantha-owned
  `batches:replace`, which consumes terminal `block_and_replan` evidence,
  writes a new `planned` BatchSpec at the observed target `HEAD`, resets task
  and integration queue statuses to pre-dispatch state, removes worker run and
  candidate evidence, and records `batch-replacement-audit.jsonl`
- source BatchSpecs can be explicitly marked `rejected` only through the
  Samantha-owned `batches:reject` mutation surface, which records before/after
  audit evidence and does not mutate task statuses, candidate evidence, or
  `integrationQueue`
- cleanup runs only after accepted candidates have lifecycle evidence and final
  verification passes

Still deferred or explicit-only items:

- raising `writerCap`
- worker-owned orchestration, rebase, merge order, cleanup, or lifecycle
  mutation
- automatic stale-base generation of a replacement `BatchSpec`
- Samantha-owned rebase execution until a reviewed rebase plan/evidence contract
  exists
- mutating source BatchSpec task statuses, candidate evidence,
  `integrationQueue`, or non-rejected lifecycle states until a reviewed
  Samantha-owned mutation contract exists

Acceptance evidence:

- batch artifacts prove dependency and write-set decisions before dispatch
- failed batch members do not contaminate accepted work
- every accepted writer output is reverified after integration
- stale preflight and stale integration paths leave `block_and_replan` evidence
  with observed `HEAD`, source `baseCommit`, trigger, violations, and explicit
  `sourceBatchSpecMutation: "not_performed"`
- explicit replacement generation leaves `batch-replacement-audit.jsonl`
  evidence with source batch id, source `baseCommit`, observed `HEAD`, replan
  evidence path, replacement path, and
  `sourceBatchSpecMutation: "not_performed"`
- explicit source BatchSpec rejection leaves `batch-lifecycle-audit.jsonl`
  evidence with before/after status snapshots and
  `sourceBatchSpecMutation: "performed"`
- cleanup/lifecycle evidence is recorded per worker
- focused tests cover happy path, stale-base rejection, partial failure, and
  authority-boundary serial-only blocking
- CLI tests prove stale execution evidence is written without mutating the
  source `BatchSpec`, explicit replacement creates only a new planned BatchSpec
  through Samantha-owned authority, and explicit rejection mutates only the
  source BatchSpec status through Samantha-owned authority

Promotion rule:

Do not start this phase by raising `writerCap`. Batch orchestration must exist
before writer parallelism becomes routine.

## Deferred Product Surfaces

These adjacent surfaces are not roadmap phases yet:

- messaging or remote-control integrations
- background/watch operation
- operator UIs
- scheduled automation
- budget governance
- multi-project orchestration
- autonomous push or cleanup

Each surface needs its own reviewed product slice with authority, verification,
evidence, and lifecycle gates. None should re-enter as inherited migration
scope, and none should be rejected solely because an older slice excluded it.

## Roadmap Maintenance

Update this document only when a phase boundary, product capability, or
authority gate changes.

Do not use it for daily task tracking. Use run evidence, task specs, and
reviewed lesson artifacts for that.
