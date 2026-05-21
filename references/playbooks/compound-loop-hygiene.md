# Compound Loop Hygiene Playbook

## Purpose

Classify AI-collaboration preferences into reviewable Samantha artifacts without
turning taste, stale constraints, or external advice into hidden memory,
runtime config automation, or broad doctrine.

This S2 playbook is a manual reviewable procedure. It does not implement
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
