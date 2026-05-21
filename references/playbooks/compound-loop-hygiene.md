# Compound Loop Hygiene Playbook

## Purpose

Classify AI-collaboration preferences into reviewable Samantha artifacts without
turning taste, stale constraints, or external advice into hidden memory,
runtime config automation, or broad doctrine.

This playbook is a manual reviewable procedure. It does not implement
configuration, enforcement, promotion, pruning, resolver behavior, or trusted
state.

## When To Use

Use this playbook when an AI-collaboration preference, correction, or external
insight might affect how Samantha frames work, prepares artifacts, or preserves
trust boundaries.

Do not use it for ordinary implementation, direct runtime changes, hidden
memory cleanup, automatic transcript scanning, or automatic promotion.

## Taste And Config Placement Matrix

| Primary category | Belongs here | Placement |
| --- | --- | --- |
| Advisory guidance | Communication tone, question framing, review framing, and decomposition heuristics. | Manual playbook language or reviewer notes. These guide judgment and do not create authority. |
| Reviewable configuration candidate | Recurring task instructions, reusable prompt shapes, playbook checklist candidates, context route candidates, and template/profile candidates that still require separate review. | Candidate artifact or follow-up slice. Promotion requires explicit review before any template, profile, route, or checklist changes. |
| Hard gate | Existing non-negotiable trust/authority constraints such as no hidden memory, deterministic verification, worker authority limits, and Samantha-owned lifecycle/merge/cleanup boundaries. | Existing doctrine, policy, or lifecycle gates. If enforcement must change, route to a separate reviewed policy slice. |
| Rejected scope | Automatic transcript scanning, hidden memory, runtime config automation, automatic promotion, worker-owned orchestration, and treating stale slice-local non-goals as current global doctrine. | Reject in this slice. If the product direction should change, open a separate reviewed product or policy slice. |

## Procedure

1. Name the preference in one sentence and identify its evidence source.
2. Classify it into exactly one primary category from the matrix.
3. If it is Advisory guidance, keep it as concise manual guidance and avoid
   implying enforcement.
4. If it is a Reviewable configuration candidate, record the narrow candidate
   artifact and the separate review needed before promotion.
5. If it is a Hard gate, cite the existing authority boundary instead of
   rewriting or expanding it.
6. If it is Rejected scope, stop the S2 work and record why it cannot be
   implemented here.

When a preference appears to require enforcement, runtime configuration,
automatic promotion, trusted state, or lifecycle behavior, route it to a
separate reviewed product or policy slice instead of implementing it.

## Authority Limits

S2 may create manual review guidance only. It must not create enforcement,
policy tests, task templates, agent profiles, CLI/runtime configuration,
resolver code, automatic promotion, automatic pruning, hidden memory, or
trusted state behavior.

Workers must not use this playbook to dispatch work, create worktrees, merge,
commit, push, clean up lifecycle state, or override Samantha-owned verification
and lifecycle boundaries.

## Verification Ladder

S3 is manual guidance only. It does not create or modify policy, tests, task
templates, agent profiles, CLI/runtime code, source code, run logs, lifecycle
behavior, worker dispatch, trusted state behavior, or report-only trust gates.

For insight-derived artifact changes, use the lowest rung that verifies the
changed surface. Stronger rungs are required when a change affects executable
behavior, authority, lifecycle, dispatch, merge, scope, or trusted-state
accept/reject behavior.

Report-only/LLM review is advice-only evidence and deterministic checks own trust.
Report-only review may recommend a next action or classify risk, but it must
not make worker output trusted, accept runs, merge, clean up, change lifecycle
state, or replace deterministic verification.

| Rung | Sufficient when | Required when | Concise example |
| --- | --- | --- | --- |
| Docs check | The change is markdown-only guidance, an initiative brief update, or playbook wording that does not grant authority or change behavior. | Every insight-derived artifact change needs at least a docs check. | `git diff --check` plus grep for the new playbook terms after wording-only guidance. |
| Report-only review | The question is judgment-heavy and advice-only: doctrine fit, authority boundary, product boundary, stale constraint, or artifact placement. | Required before promoting ambiguous guidance that could be mistaken for authority or product direction. | Ask a report-only reviewer whether old dashboard/daemon/remote non-goals are stale evidence or current doctrine. |
| Focused tests | The change touches executable source, CLI behavior, parsers, template/profile behavior, or deterministic transforms. | Required before trusting any executable behavior affected by an insight-derived change. | Add a parser test proving a new artifact marker is recognized without changing unrelated CLI output. |
| Policy tests | The change affects dispatch, scope, merge, lifecycle, authority, trusted-state accept/reject behavior, or any new trust gate. | Required for any policy or trust-boundary change, even if the behavior seems small. | Add accept/reject cases proving workers cannot mark report-only output as trusted run evidence. |
| Later run evidence | The question is whether promoted guidance helps or hurts repeated real work after review. | Required before treating a reviewed guidance pattern as proven durable across repeated use. | Compare later Samantha run summaries to see whether the correction-loop guidance reduced stale-constraint drift. |

## Correction Loop

S4 is manual guidance for shaping BK corrections into reviewable candidates. It
uses the correction transcript mining boundary without turning mining into
promotion, enforcement, or durable artifact mutation.

The preserved loop is:

```text
explicit correction evidence
-> correction candidate
-> BK review
-> promoted artifact only if separately approved
-> later run evidence
```

Boundary language for this loop is strict: no transcript hunting, no automatic
transcript scanning, no automatic promotion, no hidden memory, and no direct
durable artifact edits during mining. Evidence must be explicit and
reviewable. Correction mining creates candidates only; promotion requires
separate BK review; durable guidance edits are not part of mining unless
separately authorized. A candidate becomes durable guidance only through that
promotion action, and later run evidence is needed before treating the promoted
guidance as proven.

Correction candidates should preserve the smallest auditable evidence that
survives without private context. Older slice-local constraints may be cited as
evidence to review, but they do not become global authority unless a current
canonical artifact separately promotes them.

### Sample Correction Candidate: dashboard/daemon/remote-control proof case

This sample is illustrative only. It is not a created candidate artifact and
does not authorize edits under `references/lessons/**` or any other path.

- Source type: `session_excerpt`
- Source reference: BK's explicit correction in the compound-loop hygiene
  source discussion, as summarized in this initiative brief.
- Excerpt or evidence: BK corrected the stale reading that dashboard,
  daemon/watch, and remote/control-plane surfaces were legacy prohibitions.
- Correction signal: Under current v1 doctrine, dashboard, daemon/watch, and
  remote/control-plane are v1 candidate surfaces, not automatic scope and not
  automatic rejections.
- Classification: `routing-intent`
- Affected layer: compound-loop hygiene playbook or a future reviewed stale
  constraint drift review artifact.
- Proposed change: Treat older slice-local non-goal language about
  dashboard/daemon/remote-control as evidence to review, not global authority.
- Why it matters: Reusing stale non-goal language as a hard rejection would
  block valid v1 candidate surfaces and distort future planning.
- Promotion risk: Promoting the correction too broadly could be misread as
  authorization to implement dashboard, daemon/watch, or remote/control-plane
  surfaces without a separate product slice and verification gates.
- Review question: Should this proof case be promoted into a durable stale
  constraint drift review checklist after BK review?
- Status: `candidate`

## Verification Expectations

Verification for S2 is markdown-surface verification:

- The playbook contains the required matrix and the four primary categories.
- The text states that S2 is manual reviewable guidance, not runtime config
  automation.
- The initiative brief marks S2 complete and names S3 as the only ready next
  slice.
- The diff contains no source, tests, policy, templates, profiles, resolver
  code, run logs, worktrees, or runtime configuration changes.

## Stop Conditions

Stop and route to a separate reviewed slice if the work needs policy
enforcement, runtime config automation, resolver behavior, automatic transcript
scanning, hidden memory, automatic promotion, automatic pruning, task template
changes, agent profile changes, worker-owned orchestration, or trusted state
changes.

Stop if a stale slice-local non-goal is being treated as current global
doctrine instead of evidence to review.
