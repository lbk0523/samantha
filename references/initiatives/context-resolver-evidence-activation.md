# Context Resolver Evidence Activation Initiative Brief

## Goal

Evolve Samantha's Context Resolver from a read-first routing artifact into an
Evidence Activation Layer: a manual, reviewable layer that points each task to
the smallest useful route, the relevant learning-asset status, and the evidence
pack needed before later planning or execution.

The layer should help future Samantha sessions ask, "what evidence should be
activated before this task proceeds?" without adding resolver code, automatic
context loading, hidden state, or new worker authority.

## Source

- `references/context-resolver-index.md`, which defines the current Context
  Resolver as an initial annotated routing artifact and manual routing aid.
- `references/playbooks/initiative-continuity-brief.md`, which defines the
  required shape and authority limits for multi-slice continuity briefs.
- `references/playbooks/learning-trigger-policy.md`, which preserves explicit
  review and promotion boundaries for learning artifacts.
- `references/playbooks/self-build-task-spec-lifecycle.md`, which keeps task
  specs, run evidence, verification, and lifecycle authority separated.
- `references/lessons/reviews/index.json`, which shows that lesson candidates
  have explicit review states such as `promote_candidate`, `manual_review`,
  `needs_more_evidence`, and `reject_candidate`.

## Accepted Decisions

- The Evidence Activation Layer is an artifact-level evolution of the Context
  Resolver, not resolver code, automatic context loading, or hidden memory.
- It should activate evidence by naming what to read, what learning status is
  relevant, what evidence pack is required, and what gate determines whether
  the evidence applies.
- Learning assets remain reviewable repository artifacts. A candidate, review
  record, or queue entry does not become durable doctrine, policy, or task
  guidance until the explicit review and promotion path authorizes it.
- Task specs, worker runs, `HARNESS_RESULT`, deterministic verification,
  changed-file scope, lifecycle records, and Samantha-owned commit/report
  evidence remain separate authority layers.
- The initiative may add or update documentation-only artifacts in later
  slices, but it does not authorize source code, tests, policy, task templates,
  agent profiles, run logs, lifecycle records, or runtime behavior changes.
- S1 output is the Evidence Activation Matrix playbook at
  `references/playbooks/context-resolver-evidence-activation.md`.
- S2-S5 are completed as one cohesive documentation-only autopilot slice in the
  Evidence Activation Matrix playbook; the slice adds operating guidance for
  Learning Asset Status, Evidence Pack, Applicability Gate, and Feedback Loop.
- Learning Asset Status activates review attention only. Statuses such as
  `promote_candidate`, `manual_review`, `needs_more_evidence`, and
  `reject_candidate` do not promote guidance, rewrite policy, or change
  doctrine.
- Evidence Packs must keep route hints, learning status, run evidence,
  `HARNESS_RESULT`, deterministic verification, changed-file scope, and
  lifecycle records in separate authority layers.
- The Applicability Gate may reject stale, superseded, slice-local, unrelated,
  or non-authoritative evidence without editing policy, doctrine, lessons,
  templates, source, or tests.
- Feedback from verified route gaps, missing evidence categories, or recurring
  learning-status issues must land as explicit reviewable documentation work,
  not hidden memory, automatic promotion, policy rewrite, or worker authority
  expansion.

## Non-Goals

- No hidden memory, automatic transcript mining, automatic lesson promotion,
  automatic policy rewrite, or automatic playbook rewrite.
- No background daemon, dashboard, remote/control plane, connector platform,
  operator UI, scheduled automation, budget governance, or multi-project
  orchestration.
- No worker authority expansion, writer concurrency change, worker-owned
  dispatch, worker-owned merge, worker-owned cleanup, worker-owned lifecycle
  mutation, commit, or push authority.
- No changes to `src/**`, `tests/**`, task specs, task templates, agent
  profiles, lessons, playbooks, resolver index, run logs, lifecycle records,
  package files, or policy unless a future separately authorized task names
  those files as target scope.
- No claim that report-only review, thread summaries, route hints, or learning
  queue status are trusted completion evidence.

## Invariants

- The smallest matching route wins; broad context loading remains a last resort
  only when the task itself requires it.
- Context Resolver artifacts are advisory routing and evidence activation aids;
  deterministic checks and Samantha lifecycle records own trusted state.
- Evidence must stay explicit, reviewable, and repository-backed when it affects
  future behavior.
- Lesson candidates and review queue entries are evidence to consider, not
  promoted guidance by themselves.
- A task that changes authority, policy, doctrine, lifecycle, templates,
  profiles, runtime behavior, or trusted state must go through its own reviewed
  scope and verification path.
- Workers must not gain orchestration, merge, push, cleanup, lifecycle,
  promotion, or policy authority from this initiative.
- This brief does not replace task specs, run logs, lifecycle records, or
  deterministic verification.

## Slice Queue

### S1: Route Map

- Status: completed
- Objective: Draft a compact route map that shows how current Context Resolver
  routes map to evidence categories: direction docs, playbooks, task specs, run
  evidence, lesson candidates, review records, and lifecycle records.
- Dependency: This brief.
- Verification: Markdown diff check plus explicit confirmation that no resolver
  code, automatic loading, policy, task template, agent profile, run log, or
  lifecycle behavior changed.
- Changed files:
  - `references/playbooks/context-resolver-evidence-activation.md`
  - `references/initiatives/context-resolver-evidence-activation.md`
- Verification intent:
  - Confirm the playbook exists.
  - Confirm the Evidence Activation Matrix includes route-level evidence
    activation columns.
  - Confirm manual/reviewable non-goals remain explicit.
  - Confirm S1 is completed and S2 is the next ready slice.
  - Run markdown diff whitespace checks for the changed files.
- Accepted decision: S1 output is an operating playbook named the Evidence
  Activation Matrix, not an update to `references/context-resolver-index.md`.
- Historical prompt:

```text
sam p: context-resolver-evidence-activation S1 Route Map
Context:
Read references/initiatives/context-resolver-evidence-activation.md and references/context-resolver-index.md first.
Ask:
Draft the smallest documentation-only Route Map slice that connects current Context Resolver routes to evidence categories without changing resolver behavior.
Scope:
Docs-only. Do not edit source, tests, policy, task specs, task templates, agent profiles, lessons, run logs, lifecycle records, or platform/runtime surfaces.
Output:
Korean report plus the exact artifact changes and verification evidence.
Stop:
Stop if the slice would require resolver code, automatic context loading, hidden memory, or authority changes.
```

### S2: Learning Asset Status

- Status: completed
- Objective: Define how a future route should display learning asset status
  using existing review classifications such as `promote_candidate`,
  `manual_review`, `needs_more_evidence`, and `reject_candidate`.
- Dependency: S1 completed.
- Verification: Markdown diff check plus an example showing that status
  activates review attention without promoting guidance or changing policy.
- Changed files:
  - `references/playbooks/context-resolver-evidence-activation.md`
  - `references/initiatives/context-resolver-evidence-activation.md`
- Verification intent:
  - Confirm the playbook contains a `Learning Asset Status` section.
  - Confirm the section names `promote_candidate`, `manual_review`,
    `needs_more_evidence`, and `reject_candidate`.
  - Confirm the example says status activates review attention without
    promotion, policy rewrite, doctrine change, or worker authority expansion.
- Accepted decision: Learning Asset Status is a review-attention signal only;
  it does not make a candidate promoted guidance or trusted task instruction.
- Historical prompt:

```text
sam p: context-resolver-evidence-activation S2 Learning Asset Status
Context:
Read references/initiatives/context-resolver-evidence-activation.md, references/playbooks/context-resolver-evidence-activation.md, and references/playbooks/learning-trigger-policy.md first.
Ask:
Define the smallest documentation-only Learning Asset Status slice for the Evidence Activation Matrix. Show how statuses such as promote_candidate, manual_review, needs_more_evidence, and reject_candidate should activate review attention without promoting guidance or changing policy.
Scope:
Docs-only. Do not edit source, tests, policy, task specs, task templates, agent profiles, lessons, run logs, lifecycle records, resolver code, or platform/runtime surfaces. Do not edit references/context-resolver-index.md yet.
Output:
Korean report plus exact artifact changes, one status example, and verification evidence.
Stop:
Stop if the slice would require automatic promotion, hidden memory, policy rewrite, resolver code, automatic context loading, or worker authority expansion.
```

### S3: Evidence Pack

- Status: completed
- Objective: Define the minimum evidence pack for common task families, such as
  docs-only edits, doctrine-sensitive review, policy changes, failed-run
  recovery, learning promotion, and self-build task spec lifecycle decisions.
- Dependency: S2 completed.
- Verification: Markdown diff check plus examples that keep route hints,
  learning status, run evidence, `HARNESS_RESULT`, and lifecycle records in
  separate authority layers.
- Changed files:
  - `references/playbooks/context-resolver-evidence-activation.md`
  - `references/initiatives/context-resolver-evidence-activation.md`
- Verification intent:
  - Confirm the playbook contains an `Evidence Pack` section.
  - Confirm common task families include docs-only edits, doctrine-sensitive
    review, policy changes, failed-run recovery, learning promotion, and
    self-build task spec lifecycle decisions.
  - Confirm route hints, learning status, run evidence, `HARNESS_RESULT`,
    deterministic verification, changed-file scope, and lifecycle records stay
    separate.
- Accepted decision: Missing evidence layers must be named as missing instead
  of substituted with route hints, status, `HARNESS_RESULT`, verification, or
  lifecycle evidence from another layer.
- Next prompt: Historical only; completed in the S2-S5 autopilot slice.

### S4: Applicability Gate

- Status: completed
- Objective: Define the manual Applicability Gate that decides whether activated
  evidence actually applies to the current task, including when stale,
  slice-local, superseded, or unrelated evidence must be ignored.
- Dependency: S3 completed.
- Verification: Markdown diff check plus at least one stale-or-unrelated
  evidence example that is rejected without editing policy, doctrine, lessons,
  templates, source, or tests.
- Changed files:
  - `references/playbooks/context-resolver-evidence-activation.md`
  - `references/initiatives/context-resolver-evidence-activation.md`
- Verification intent:
  - Confirm the playbook contains an `Applicability Gate` section.
  - Confirm stale, superseded, slice-local, unrelated, and non-authoritative
    evidence are reject cases.
  - Confirm rejection does not edit policy, doctrine, lessons, templates,
    source, or tests.
- Accepted decision: The Applicability Gate is a manual use/reject decision for
  activated evidence, not an authorization to rewrite the evidence source.
- Next prompt: Historical only; completed in the S2-S5 autopilot slice.

### S5: Feedback Loop

- Status: completed
- Objective: Define the documentation-only Feedback Loop for updating the
  Evidence Activation Layer after a verified slice reveals a useful route,
  missing evidence category, or recurring learning-status issue.
- Dependency: S4 completed.
- Verification: Markdown diff check plus a closure checklist proving that any
  proposed update remains explicit, reviewable, manual, and separate from
  automatic learning or trusted-state mutation.
- Changed files:
  - `references/playbooks/context-resolver-evidence-activation.md`
  - `references/initiatives/context-resolver-evidence-activation.md`
- Verification intent:
  - Confirm the playbook contains a `Feedback Loop` section.
  - Confirm verified route gaps, missing evidence categories, and recurring
    learning-status issues land as reviewable documentation updates.
  - Confirm the closure checklist blocks hidden memory, automatic promotion,
    policy rewrite, background daemon, dashboard, remote/control plane, and
    worker authority expansion.
- Accepted decision: Feedback from this layer becomes a future explicit
  documentation task or review path; it is not automatic context loading,
  hidden memory, automatic promotion, policy rewrite, or trusted-state
  mutation.
- Next prompt: Historical only; completed in the S2-S5 autopilot slice.

## Current Next Slice

no-current-next-slice

Closure decision: Route Map, Learning Asset Status, Evidence Pack,
Applicability Gate, and Feedback Loop are now documented as a coherent manual
Evidence Activation Layer. Pointer cleanup in
`references/context-resolver-index.md` remains out of scope and can be a
separate future task only if needed.

## End-of-Session Update Rule

At the end of each slice, update this brief with:

- the completed slice status;
- the files changed;
- deterministic verification evidence or the reason verification is
  unavailable;
- any new blocker or authority question;
- any accepted decision that later sessions should not reopen casually;
- exactly one next ready slice and its current prompt, or
  `no-current-next-slice`, `recovery-needed`, `blocked`, or `closure decision`.

Completed prompts become historical prompts and must not be reused as current
handoffs after their slice is completed, failed, dropped, or superseded.

## Completion Rule

This initiative is complete when Route Map, Learning Asset Status, Evidence
Pack, Applicability Gate, and Feedback Loop are documented as a coherent manual
Evidence Activation Layer, each slice has verification evidence, no platform
surface or authority expansion has been introduced, and the brief records
`no-current-next-slice` with the closure decision.

Completion status: satisfied for this documentation-only initiative. S1 through
S5 are completed, verification intent is recorded for each slice, no source
code, tests, task specs, task templates, agent profiles, lessons, run logs,
lifecycle records, package files, policy, platform surface, or authority
expansion was introduced, and the Current Next Slice is
`no-current-next-slice` with a closure decision.
