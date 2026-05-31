# Samantha Operating Flow Improvement Initiative Brief

Status: completed
Source: BK and Codex planning session on 2026-05-27 about improving the
`sam b:` -> `sam p:` -> `sam c:` operating flow without starting Samantha
self-build implementation in that discussion.

## Goal

Make Samantha's operator flow smoother without weakening the harness gates.

The durable outcome is:

```text
unclear user direction
-> grill-style brainstorm decision loop
-> plan readiness review with artifact and slice-sizing gates
-> bounded command continuation for AFK-ready approved slices
-> stop on product, authority, lifecycle, verification, or repository risk
```

BK should spend attention on direction and real decisions, not on repeatedly
copying the next tiny `sam c:` prompt or judging plausible-looking code plans
without enough domain evidence.

## Source

- BK's concern that the high-level `brainstorm -> plan -> command` flow is
  right, but each stage's detailed operating behavior is too rough.
- BK's preferred brainstorm style: the local `grill-me` and `grill-with-docs`
  skills, especially one-question decision loops, recommended answers, and
  code/doc exploration before asking questions that evidence can answer.
- Review of `mattpocock/skills`, especially `to-prd`, `to-issues`, and `tdd`,
  as planning-flow references rather than artifacts to copy wholesale.
- Existing Samantha rules in `OPERATING_GUIDE_KR.md`, `WORK-RULES.md`, and
  `references/playbooks/initiative-continuity-brief.md`.
- Existing Sequential CEO Autopilot evidence showing one writer slice can run
  through guarded `run_task`, guarded `runs:accept`, post-accept status update,
  and deterministic stop reporting without BK issuing a scheduler prompt inside
  that single writer-slice lifecycle.

## Short PRD / Capability Brief

### Problem

Samantha currently tends to move too quickly from uncertain direction to plan,
and from plan to small command handoffs. This makes BK do two forms of work
that Samantha should reduce:

- judge whether a codebase plan is actually sound;
- manually schedule a stream of small follow-up commands.

### User-Facing Capability

Samantha should make each stage earn its handoff:

- `sam b:` clarifies fuzzy direction through a grill-style decision interview.
- `sam p:` decides whether the work is ready for command, needs more planning,
  needs brainstorm, needs review, or is blocked.
- `sam c:` can continue through approved AFK-ready slices within a bounded
  envelope instead of handing BK another tiny prompt after every safe step.

### Success Criteria

- A future `sam p:` result cannot skip artifact, verification, stop-condition,
  or slice-sizing judgment.
- A multi-slice plan has one durable parent artifact before individual task
  specs or command slices are generated.
- A future `sam b:` does not harden unresolved decisions into a plan.
- A future `sam c:` does not make BK act as the scheduler when the approved
  initiative already contains AFK-ready slices and no stop condition is active.

## Accepted Decisions

- `sam p:` should be strengthened into a Plan Readiness Review, not just a
  prose implementation plan.
- Small single-slice work may stay as text-only plan output.
- Long-running or multi-slice work should use an `Artifact decision` field to
  decide whether to create or update an Initiative Continuity Brief under
  `references/initiatives/`.
- Short PRD and checklist content should normally live inside the Initiative
  Continuity Brief instead of becoming separate competing parent artifacts.
- `sam p:` must include an explicit slice-sizing gate that blocks
  micro-slicing. Slices should be grouped around cohesive work surfaces, not
  tiny individual invariants.
- Related changes that share a validator, artifact shape, command workflow, or
  verification boundary should default to one command slice when they can be
  tested, verified, committed, and pushed together without crossing authority
  boundaries.
- Smaller slicing is justified only by a clear authority, verification,
  lifecycle, product uncertainty, broad framework, or repository-risk reason.
- `sam b:` should behave like a grill-style question loop during conversation:
  one question at a time, recommended answer, tradeoff, and why the decision
  matters.
- `sam b:` should add Samantha-specific exit gating only at the close: accepted
  decisions, rejected alternatives, open decisions, decision debt, readiness
  verdict, continuity artifact decision, and recommended next prompt.
- `sam c:` should reduce BK's manual scheduling burden by supporting bounded
  continuation through approved AFK-ready slices when a durable initiative
  artifact and ordinary Samantha gates make that safe.
- S5 dogfood found that docs plus existing commands are sufficient for now.
  S4 deterministic support is not activated in this initiative.

## Non-Goals

- Do not bypass task specs, isolated worktrees, scope checks, deterministic
  verification, `HARNESS_RESULT`, run logs, merge checks, cleanup evidence, or
  Samantha-owned lifecycle records.
- Do not add hidden memory, transcript-only source of truth, worker-owned
  orchestration, natural-language-only dispatch, automatic push, background
  daemon/watch behavior, external integrations, dashboards, remote adapters, or
  broad routine-use authority as part of this initiative.
- Do not make `sam b:` verbose during every question turn. The heavier state
  summary belongs in the closing brief, not every prompt.
- Do not import `mattpocock/skills` wholesale. Use selected planning ideas only
  when they fit Samantha's authority model.
- Do not create task specs, dispatch workers, or edit source/tests before a
  later explicit command slice.

## Invariants

- Samantha owns orchestration, verification, local lifecycle evidence, and
  final commit/report gates.
- Workers operate only inside explicit task specs, agent profiles, target
  files, forbidden changes, and verify commands.
- Report-only evidence remains advice-only.
- A markdown initiative brief is durable parent context, not trusted execution
  state and not worker authority.
- Deterministic checks own trust. Reviewable procedures guide judgment.
- Any authority-moving behavior must be designed, reviewed, and verified before
  routine use.
- At most one current next slice should be ready when no session is active.

## Plan Readiness Review Shape

Future `sam p:` outputs should use this shape when the work is more than a
trivial single-slice plan:

```text
Plan Readiness Review
- Stage classification:
- Artifact decision:
- Durable artifact path:
- Accepted decisions used:
- Decision debt:
- Codebase evidence:
- Target capability / artifact boundary:
- Proposed execution units:
- Slice sizing gate:
  - Are we splitting by cohesive work surface, not tiny invariants?
  - Can related changes sharing validator / artifact shape / command workflow /
    verification boundary be grouped safely?
  - If split smaller, what authority, verification, lifecycle, product
    uncertainty, broad framework, or repository-risk reason justifies it?
- Slice sizing rationale:
- HITL vs AFK classification:
- Intended files / artifact families:
- Verification strategy:
- Stop conditions:
- Plan verdict:
- Recommended next prompt:
```

Valid plan verdicts are:

- `ready_for_command`
- `needs_brainstorm`
- `needs_plan_refinement`
- `needs_review`
- `blocked`

If the slice-sizing gate fails, `sam p:` must not return `ready_for_command`.
It should return `needs_plan_refinement` unless the reason for the bad slicing
is a missing product or authority decision, in which case it should route back
to `sam b:`.

## Artifact Decision Rule

Use this rule inside `sam p:`:

- `none`: single small slice; inline plan is enough.
- `create_initiative_brief`: multi-slice work where future sessions need
  durable context.
- `update_initiative_brief`: an existing initiative continues or changes.
- `create_short_prd_section`: product or capability behavior is still the main
  source of ambiguity; add it inside the initiative brief unless a separate
  product artifact is already the source of truth.

Do not create a continuity brief for ordinary daily task tracking, a finished
report-only review, or a single small follow-up.

## Brainstorm Loop / Brief Shape

During `sam b:`, use the lightweight grill-style question shape:

```text
Question:
Recommended answer:
Tradeoff:
Why this matters:
```

Close `sam b:` with:

```text
Brainstorm Brief
- Goal:
- Accepted decisions:
- Rejected alternatives:
- Open decisions:
- Decision debt:
- Ready for: continue_brainstorm | plan | command | blocked
- Continuity artifact decision:
- Recommended next prompt:
```

Do not move from brainstorm to plan while the main product direction,
authority boundary, artifact lifecycle, validation boundary, or stop condition
is still unresolved.

## Command Bounded Continuation Rule

`sam c:` should stop making BK copy the next prompt when all of these are true:

- the work belongs to an approved Initiative Continuity Brief;
- the next slices are AFK-ready;
- each slice has target files or artifact family, verification, and stop
  condition;
- no product, authority, policy, lifecycle, or priority decision is needed;
- Samantha can update local evidence after each slice;
- existing Samantha gates can verify every trusted state transition.

`sam c:` must stop when any of these are true:

- product, scope, priority, or authority decision needed;
- doctrine, policy, contract, task template, agent profile, package metadata,
  lockfile, or authority-boundary work lacks a reviewed plan;
- target files, artifact family, verification, lifecycle handling, or stop
  condition is missing or ambiguous;
- repo state is dirty, stale, or otherwise unsafe;
- worker evidence lacks valid `HARNESS_RESULT`;
- scope checks or deterministic verification fail;
- push, secrets, connector access, background operation, hidden memory, or
  broader routine-use authority is needed;
- Samantha cannot update local evidence without inventing facts.

## Bounded Command Continuation Boundary Decision

S2 decision: bounded command continuation is eligible as a reviewed command
coordination surface, but only as a continuation of explicit local artifacts
through existing Samantha gates. It is not a background loop, a natural
language scheduler, a broad ROADMAP executor, or a worker-owned orchestration
surface.

The initial boundary is:

- Input must be an approved Initiative Continuity Brief with exactly one
  current ready slice or a deterministic next-slice chain whose predecessor
  evidence is already trusted.
- Trusted routing must come from a structured continuation artifact that cites
  the Initiative Continuity Brief. Markdown roadmap prose, chat transcript, or
  worker summaries cannot authorize successor execution.
- Each executable writer slice must still use an explicit TaskSpec, declared
  target files, forbidden changes, verify commands, isolated worktree,
  `HARNESS_RESULT`, deterministic verification, scope checks, and
  Samantha-owned accept/lifecycle gates.
- `sam c:` may coordinate multiple safe actions inside one command turn only
  when each action's ordinary gate passes and the next action is already
  represented by validated structured continuation state.
- Successful continuation is not failed-evidence rework. Failed evidence gets
  at most one narrow rework cycle, then Samantha stops and reports.
- Push remains outside this boundary. Batch execution, multi-writer execution,
  daemon/watch behavior, remote adapters, dashboards, hidden memory, and broad
  routine-use authority remain outside this boundary until separately reviewed.

### Autonomy Envelope

The initial operating-flow envelope is:

```yaml
canSelectNextReadySlice: true
canRunReadinessChecks: true
canRunReportOnlyActions: true
canRunExplicitTaskSpecs: true
canAcceptVerifiedRuns: true
canUpdateContinuationStatus: true
canLocallyCommitThroughExistingGates: true
canExecuteDeterministicSuccessor: true
pushAllowed: false
batchExecutionAllowed: false
multiWriterAllowed: false
backgroundOperationAllowed: false
requiresStructuredContinuationArtifact: true
requiresFreshPreflightPerSlice: true
maxFailedEvidenceReworkCycles: 1
```

This envelope is a design boundary, not current implementation evidence.
Routine use requires either documented no-code operation through already
available commands or focused deterministic support with tests.

### Reused Existing Gates

Bounded command continuation must reuse these existing gates instead of
creating a parallel trust path:

- Initiative Continuity Brief status vocabulary and current-next-slice rules.
- Sequential CEO Autopilot structured continuation artifact validation.
- `continuation:show` / next-artifact validation for explicit successor paths.
- `runTaskCandidate` preflight before any `run_task` execution.
- `continuation:run-task-once` and the existing `run-task` gate for TaskSpec,
  isolated worktree, worker run, `HARNESS_RESULT`, scope, and verification.
- `runAcceptCandidate` preflight before any run accept execution.
- `continuation:accept-run-once` and the existing `runs:accept` gate for merge,
  lifecycle, and cleanup evidence.
- `continuation:update-status-after-accept` for status transition from accepted
  lifecycle evidence.
- `readiness:check` for deterministic initiative/task readiness checks.
- Existing Phase 5.5/Phase 5 batch review and preflight surfaces only as
  report-only or separately reviewed batch authority. This initiative does not
  approve batch execution.

### Evidence Expectations

Each continuation report must cite:

- initiative path and structured continuation artifact path;
- current slice id, selected action type, and status transition;
- exact local evidence used for the transition;
- verify commands and pass/fail status when verification applies;
- whether the action was successful continuation or failed-evidence rework;
- remaining failed-evidence rework budget;
- side-effect map, including explicit `pushPerformed: false` and
  `batchExecutionPerformed: false`;
- next ready slice or active stop condition;
- exact next Samantha command or no-next-action reason.

### Stop Conditions

Bounded command continuation must stop when:

- the next slice needs a BK product, scope, priority, or authority decision;
- the next slice targets doctrine, policy, contracts, agent profiles, task
  templates, package metadata, lockfiles, or authority boundaries without a
  reviewed plan;
- the next action lacks target files, forbidden changes, verify commands,
  repo root, base evidence, or lifecycle handling;
- the repo has unrelated dirty changes, stale base evidence, or unresolved
  lifecycle state;
- the structured continuation artifact is missing, invalid, stale, or names an
  unknown action type;
- worker run evidence lacks valid `HARNESS_RESULT`;
- scope checks or deterministic verification fail;
- the next action requires push, secrets, connector access, background
  operation, hidden memory, operator UI, remote adapter, dashboard scope,
  multi-project orchestration, batch execution, or multi-writer execution;
- Samantha cannot update local evidence without inventing facts.

### Artifact / Document Update Recommendation

Next docs work should codify this boundary in the operator-facing command
handoff rules before any deterministic implementation. The update should keep
the reusable contract in existing operating docs or Sequential CEO Autopilot
guidance rather than creating a parallel authority model.

## Slice Queue

| Slice | Status | Objective | Depends on | Verification | Next prompt |
| --- | --- | --- | --- | --- | --- |
| S0 | completed | Preserve this operating-flow plan as a durable Initiative Continuity Brief before task specs, worker dispatch, source edits, or test edits. | BK explicit `sam p:` request. | Docs check passed; initiative brief exists. | n/a |
| S1 | completed | Update operating guide and work rules for Plan Readiness Review, Artifact decision, Slice sizing gate, and grill-style Brainstorm Brief gate. | S0 | Markdown diff check and targeted `rg` passed. | n/a |
| S2 | completed | Decide bounded command continuation authority boundary and reused existing gates. | S1 | Boundary decision recorded; docs verification passed. | n/a |
| S3 | completed | Codify bounded command continuation boundary in operating docs. | S2 | Markdown diff check and targeted `rg` passed. | n/a |
| S4 | dropped | Add deterministic support only if dogfood proves docs plus existing commands are insufficient. | S3 plus dogfood evidence requiring code. | Not activated; S5 found docs plus existing commands sufficient for now. | n/a |
| S5 | completed | Dogfood revised flow and decide closure readiness or S4 activation. | S3; S4 only if activated. | Report-only dogfood found closure-ready; no deterministic support needed now. | n/a |

## Slice Details

### S0: Preserve Initiative Brief

- Status: completed
- Objective: Preserve this operating-flow plan as a durable Initiative
  Continuity Brief before task specs, worker dispatch, source edits, or test
  edits.
- Dependency: BK's explicit `sam p:` request in the source session.
- Verification: `git diff --check HEAD -- '*.md' 'references/**/*.md'`.
- Handoff prompt: Historical only; this slice is completed by this brief.

### S1: Update Operating Guide And Work Rules

- Status: completed
- Objective: Update the user-facing operating guidance so `sam p:` includes
  Plan Readiness Review, artifact decision, and slice-sizing gate behavior, and
  so `sam b:` reflects the grill-style loop plus closing gate.
- Dependency: S0 completed.
- Verification: Markdown diff check; explicit grep or review that the guide
  includes Plan Readiness Review, Artifact decision, Slice sizing gate,
  Brainstorm Brief readiness verdict, and continuity artifact decision wording.
- Verification note: Updated `OPERATING_GUIDE_KR.md`, `OPERATING_GUIDE.md`,
  and `WORK-RULES.md` with the Plan Readiness Review, Artifact decision, Slice
  sizing gate, grill-style brainstorm loop, and closing Brainstorm Brief gate.
  Passed `git diff --check HEAD -- '*.md' 'references/**/*.md'`; because this
  initiative brief is still untracked, also passed a no-index whitespace check
  against this file. Targeted `rg` confirmed the named operating concepts
  appear in the guide and work-rules surfaces.
- Slice sizing gate: Group the `sam p:` and `sam b:` guidance together because
  they share the same operating-guide artifact family and handoff semantics.
  Do not split them into one slice per heading.
- Historical handoff prompt:

```text
sam c: update operating guide for stronger plan and brainstorm gates
Context:
- Read references/initiatives/samantha-operating-flow-improvement.md first.
- S1 updates only user-facing operating guidance for sam p and sam b.
Ask:
- Update OPERATING_GUIDE_KR.md, OPERATING_GUIDE.md, and WORK-RULES.md as needed
  so sam p includes Plan Readiness Review, Artifact decision, and Slice sizing
  gate behavior, and sam b uses a grill-style question loop plus closing
  Brainstorm Brief gate.
Scope:
- Docs-only.
- Do not edit source, tests, task specs, task templates, agent profiles, run
  logs, worktrees, package metadata, or lockfiles.
Output:
- Changed-file scope.
- Verification result.
- Updated next-slice state in this initiative brief if the slice completes.
Stop:
- Stop before source/test edits, task spec creation, worker dispatch, or any
  new command continuation authority.
```

### S2: Design Bounded Command Continuation Surface

- Status: completed
- Objective: Decide the reviewed product/authority boundary for `sam c:`
  bounded continuation beyond the existing one-writer-slice MVP evidence.
- Dependency: S1 completed.
- Verification: Markdown diff check; design text must name autonomy envelope,
  stop conditions, evidence expectations, and what existing Sequential CEO
  Autopilot gates are reused rather than bypassed.
- Verification note: Added the Bounded Command Continuation Boundary Decision
  section to this brief. The decision names the autonomy envelope, reused
  gates, evidence expectations, and stop conditions. It preserves existing
  Sequential CEO Autopilot gates and explicitly excludes push, batch execution,
  multi-writer execution, background operation, remote adapters, dashboards,
  hidden memory, and broad routine-use authority. Passed docs verification for
  this slice.
- Slice sizing gate: Keep this as a design slice because it touches command
  continuation authority. Do not mix it with implementation or guide wording.
- Historical handoff prompt:

```text
sam p: design bounded command continuation boundary for operating flow initiative
Context:
- Read references/initiatives/samantha-operating-flow-improvement.md first.
- S1 is completed. S2 is about the reviewed product/authority boundary for
  sam c bounded continuation beyond the existing one-writer-slice MVP evidence.
Ask:
- Decide the bounded command continuation surface: autonomy envelope, stop
  conditions, evidence expectations, and which existing Sequential CEO
  Autopilot gates are reused rather than bypassed.
Scope:
- Design/docs-only.
- Do not edit source, tests, task specs, task templates, agent profiles, run
  logs, worktrees, package metadata, or lockfiles.
- Do not implement new command continuation authority.
Output:
- Boundary decision.
- Artifact/document update recommendation.
- Verification strategy.
- Updated next-slice state in this initiative brief if the slice completes.
Stop:
- Stop before implementation, task spec creation, worker dispatch, or any new
  command continuation authority.
```

### S3: Codify Command Continuation Boundary In Operating Docs

- Status: completed
- Objective: Update operator-facing docs so `sam c:` bounded continuation uses
  the S2 boundary: approved initiative, structured continuation artifact,
  reused existing gates, bounded autonomy envelope, evidence expectations, and
  mandatory stop conditions.
- Dependency: S2 completed and accepted.
- Verification: Markdown diff check plus targeted `rg` for bounded
  continuation, structured continuation artifact, autonomy envelope, stop
  conditions, and reused gates in the updated docs.
- Verification note: Updated `OPERATING_GUIDE_KR.md`, `OPERATING_GUIDE.md`,
  and `WORK-RULES.md` so bounded command continuation requires approved
  Initiative Continuity Brief context, structured continuation artifact routing,
  reused existing gates, bounded autonomy envelope, evidence reporting, and
  mandatory stop conditions. No source, tests, task specs, task templates,
  agent profiles, run logs, worktrees, package metadata, or lockfiles were
  changed. Passed docs verification for this slice.
- Slice sizing gate: Group the command-continuation docs together because they
  share the same operator-facing command handoff boundary. Do not split by each
  stop condition or envelope field.
- Historical handoff prompt:

```text
sam c: codify bounded command continuation boundary in operating docs
Context:
- Read references/initiatives/samantha-operating-flow-improvement.md first.
- S2 is completed. S3 codifies the S2 boundary in operator-facing docs.
Ask:
- Update the relevant operating docs so sam c bounded continuation requires an
  approved Initiative Continuity Brief, structured continuation artifact,
  reused existing Samantha gates, bounded autonomy envelope, evidence
  expectations, and mandatory stop conditions.
Scope:
- Docs-only.
- Do not edit source, tests, task specs, task templates, agent profiles, run
  logs, worktrees, package metadata, or lockfiles.
- Do not implement new command continuation authority.
Output:
- Changed-file scope.
- Verification result.
- Updated next-slice state in this initiative brief if the slice completes.
Stop:
- Stop before implementation, task spec creation, worker dispatch, or any new
  command continuation authority.
```

### S4: Implement Deterministic Planning Support If Needed

- Status: dropped
- Objective: Add deterministic support only if S3 or later dogfood evidence
  proves the command-continuation boundary cannot be reliably operated through
  existing commands and docs.
- Dependency: S3 completed and accepted.
- Verification: Not run because S4 was not activated.
- Slice sizing gate: Group related deterministic checks by validator or command
  workflow. Do not create one worker task per field unless authority or
  verification demands it.
- Activation rule: Do not make S4 the current next slice unless dogfood or
  review evidence proves docs plus existing commands cannot operate the
  boundary reliably.
- Closure note: S5 dogfood found no current need for deterministic support.
  Existing `readiness:check` and continuation command surfaces are enough for
  this operating-flow improvement. Future deterministic work should be planned
  as a separate initiative if new evidence shows a gap.

### S5: Dogfood And Closure Decision

- Status: completed
- Objective: Dogfood the revised flow on one real Samantha planning or command
  scenario, then decide whether the initiative is complete or whether broader
  routine-use authority belongs in a separate reviewed initiative.
- Dependency: S4 completed, or S3 completed if no deterministic code is needed.
- Verification: A dogfood report citing the prompt, artifacts read, outcome,
  stop condition behavior, and whether BK avoided unnecessary manual scheduling.
- Verification note: S5 dogfood reviewed this initiative after the Slice Queue
  was normalized into parser-readable table form. `readiness:check` passed with
  S5 as the only ready slice. Targeted review confirmed the operating docs now
  cover Plan Readiness Review, Artifact decision, Slice sizing gate,
  grill-style Brainstorm Brief, and bounded command continuation. Existing
  continuation commands already provide the needed deterministic surfaces, and
  this initiative did not create a structured continuation artifact, so no
  successor execution was appropriate. Closure recommended; S4 was not
  activated.
- Slice sizing gate: Keep dogfood and closure together only if the dogfood
  evidence is report-only and narrow. Split closure into its own slice if the
  evidence implies new authority or implementation.
- Historical prompt:

```text
sam r: dogfood revised operating flow and decide closure readiness
Context:
- Read references/initiatives/samantha-operating-flow-improvement.md first.
- S1-S3 are completed. The revised flow now documents Plan Readiness Review,
  Artifact decision, Slice sizing gate, grill-style brainstorm, and bounded
  command continuation boundary.
Ask:
- Report-only dogfood the revised flow against this initiative or another
  narrow Samantha planning/command scenario.
- Decide whether docs plus existing commands are enough for now, whether S4
  deterministic support needs planning, or whether the initiative can move to
  closure/no-current-next-slice.
Scope:
- Report-only.
- Do not edit source, tests, task specs, task templates, agent profiles, run
  logs, worktrees, package metadata, or lockfiles.
- Do not dispatch workers or implement new command continuation authority.
Output:
- Dogfood evidence.
- Findings and residual risks.
- Closure recommendation or S4 activation recommendation.
- Updated next-slice state in this initiative brief if the slice completes.
Stop:
- Stop before implementation, task spec creation, worker dispatch, or any new
  command continuation authority.
```

## Current Next Slice

no-current-next-slice

This initiative is closed. S4 was not activated because S5 dogfood found that
docs plus existing commands are sufficient for now. Future deterministic
support should start as a separate reviewed initiative only if new dogfood or
review evidence proves a concrete gap.

## 2026-05-31 Operating Contract Consolidation

Status: completed

This follow-up consolidation reduces drift across Samantha's operator surfaces.
It keeps the initiative closed and records the current canonical owner map:

| Surface | Canonical role |
| --- | --- |
| `AGENTS.md` | Product boundary, hard authority gates, and source-map pointers. |
| `OPERATING_GUIDE_KR.md` | BK-facing Samantha intent, sticky routing, same-thread shortcut, and handoff protocol. |
| `WORK-RULES.md` | Codex/Samantha working discipline, self-build authority gate, lifecycle rules, completion checks, and final response checklist. |
| `/Users/byung/.codex/skills/samantha-operator/SKILL.md` | Thin global router that activates Samantha routing and points to canonical repo documents. |

Accepted decisions:

- Include the global `samantha-operator` skill in the operating-contract work;
  repo docs alone are not enough because the skill is the actual Codex routing
  surface.
- Delete `OPERATING_GUIDE.md` instead of keeping an English summary. Korean is
  the canonical operating guide, and a summary-only English copy would preserve
  a drift surface without adding operational value.
- Leave historical references in completed slice notes, `references/tasks/**`,
  and `references/operations/**` unchanged. They are evidence from the time they
  were created, not active routing surfaces.

Verification boundary:

- Active references should point to `OPERATING_GUIDE_KR.md`, `WORK-RULES.md`,
  and `AGENTS.md` according to their role.
- The global skill should not duplicate drift-prone policy lists when it can
  point to canonical repo documents.
- Future changes to Samantha operation should update the canonical owner first
  and use the other surfaces as pointers, not parallel policy stores.

## Verification Strategy

- Docs-only slices: `git diff --check HEAD -- '*.md' 'references/**/*.md'`.
- Guide wording slices: docs check plus targeted review or grep for the named
  operating concepts.
- Design slices: docs check plus explicit authority-boundary review against
  `NORTH_STAR.md`, `ARCHITECTURE.md`, `OPERATING_GUIDE_KR.md`, and existing
  Sequential CEO Autopilot artifacts.
- Deterministic implementation slices, if any: focused tests for the changed
  core module or CLI surface, then broader typecheck or test commands only when
  the changed surface can affect shared behavior.
- Dogfood/closure slice: report-only evidence or run evidence cited in the
  brief before declaring completion.

## Stop Conditions

Stop before continuing when:

- the next step needs BK to decide product direction, priority, or authority;
- the next step would create source/test changes without an accepted
  implementation boundary;
- the next step would create task specs or dispatch workers before the
  plan/design slice is complete;
- the next step would weaken worktree, verification, `HARNESS_RESULT`, scope,
  lifecycle, cleanup, commit, or push gates;
- the next step would add hidden memory, background operation, remote adapters,
  dashboard scope, connector access, automatic push, or broad routine-use
  authority without a separate reviewed product slice;
- verification fails or the repo has unrelated dirty changes.

## End-of-Session Update Rule

After each slice, update this brief with:

- final slice status;
- verification evidence or reason verification is unavailable;
- changed accepted decisions;
- new blockers or authority questions;
- next-slice state;
- current next prompt when a next slice exists.

Completed slice prompts are historical and must not be reused as current
handoffs.

## Completion Rule

This initiative can close when:

- `sam p:` guidance includes Plan Readiness Review, Artifact decision, and
  Slice sizing gate behavior;
- `sam b:` guidance reflects the grill-style one-question loop plus closing
  Brainstorm Brief gate;
- `sam c:` bounded continuation has a reviewed authority boundary and either a
  documented no-code decision or verified deterministic support;
- at least one dogfood or report-only review shows the updated flow preserves
  gates while reducing BK's manual planning or scheduling burden;
- this brief says `no-current-next-slice` or moves broader continuation
  authority into a separate initiative boundary.
