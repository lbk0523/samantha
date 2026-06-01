# Context Resolver Evidence Activation Playbook

Status: active

## Purpose

Use this playbook when a Context Resolver route needs to activate the evidence
that should be inspected before Samantha plans, reviews, recovers, or executes
work.

This is an Evidence Activation Matrix, not resolver code. It expands the
manual routing index into a route-level evidence checklist so a session can ask:

```text
Which route applies, which evidence categories matter, what status should be
checked, what pack proves the work, and where should feedback land afterward?
```

## Authority Boundary

This playbook preserves the current manual and reviewable boundary:

- no resolver code;
- no automatic context loading;
- no hidden memory;
- no platform surfaces, background daemon, dashboard, or remote/control plane;
- no automatic promotion;
- no policy rewrite;
- no worker authority expansion.

The matrix activates evidence to inspect. It does not make evidence trusted by
itself. Trusted state still comes from deterministic verification,
Samantha-owned lifecycle records, changed-file scope checks, and the appropriate
review or promotion path.

## How To Use

1. Match the smallest route from `references/context-resolver-index.md`.
2. Inspect only the activated evidence categories needed by that route.
3. Check the relevant learning asset statuses without treating queue status as
   promoted guidance.
4. Build the required evidence pack for the task family before claiming a
   planning, review, recovery, or execution result.
5. Apply the applicability warning. Ignore stale, superseded, unrelated, or
   slice-local evidence that does not apply to the current task.
6. Stop at the route's stop condition instead of broadening scope.
7. Send post-work feedback to the named target only when deterministic evidence
   shows a route, evidence category, or learning-status issue worth preserving.

## Evidence Activation Matrix

| Route | Task signal | Activated evidence categories | Learning asset statuses to inspect | Required evidence pack | Applicability warning | Stop condition | Post-work feedback target |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Brainstorm / plan | `Samantha brainstorm:` or `Samantha plan:`; open product, architecture, sequencing, or MVP-scope decisions. | Direction docs, planning playbooks, initiative briefs, accepted decisions, rejected alternatives. | Inspect only reviewed playbooks or explicit initiative decisions. Lesson candidates are background evidence unless the task asks for learning review. | Brainstorm brief or plan artifact, explicit assumptions, decision points, validation boundaries, stop conditions, and next slice prompt when accepted. | Do not treat brainstorming text as executable scope or trusted state. Broad direction docs apply only when product or authority boundaries are touched. | Stop before task dispatch, code edits, lifecycle mutation, or claiming accepted direction without BK acceptance. | `references/initiatives/**` when multi-slice continuity is accepted; otherwise the narrow planning artifact named by BK. |
| Doctrine update | Proposed change to top-level doctrine, product boundary, authority model, or MVP scope. | Doctrine docs, affected narrow artifact, prior accepted decisions, report-only review evidence. | Inspect promoted playbooks and review records only when they are cited as doctrine support. Candidate statuses may flag risk but cannot rewrite doctrine. | Documentation diff, authority-boundary explanation, changed-file scope, markdown verification, and report-only review when authority moves. | Do not import one-off lessons or stale slice-local non-goals into global doctrine. | Stop before policy code, runtime behavior, task template, or automatic enforcement unless separately authorized. | The doctrine artifact under review, plus an initiative brief when the decision spans slices. |
| Policy change | Dispatch, scope, verification, merge, lifecycle, cleanup, template/profile, or contract behavior would accept, reject, or grant authority differently. | Policy code, focused tests, affected templates or profiles, architecture trust model, failure/recovery examples. | Inspect promoted guidance and review records that describe the trust boundary. Candidate or inbox statuses only identify questions to review. | Focused accept/reject tests, changed-file scope, verification output, policy rationale, and lifecycle/report evidence after Samantha acceptance. | Advisory playbooks do not change deterministic trust gates. Do not use this route for docs-only wording. | Stop if focused tests cannot prove both intended acceptance and rejection, or if authority expansion is hidden inside docs. | Policy tests and the narrow policy artifact; learning feedback only after verified repeated evidence. |
| Self-build task spec lifecycle | Question about persistent vs ephemeral task specs, committed planning specs, clean worker bases, or post-run backfill. | Task spec lifecycle playbook, task spec path evidence, run logs, changed-file scope, verification output, lifecycle records. | Inspect promoted lifecycle playbooks and review records about task spec mistakes. Candidate statuses may suggest a recovery or learning follow-up. | Pre-dispatch spec evidence, worker base evidence, run log, `HARNESS_RESULT`, verify output, changed-file scope, and Samantha-owned lifecycle state. | Task spec evidence does not grant workers planning, dispatch, commit, cleanup, or lifecycle authority. | Stop if the path would backfill temporary specs, dispatch from a dirty base, or let workers mutate lifecycle state. | `references/playbooks/self-build-task-spec-lifecycle.md` or a future recovery/initiative artifact, not worker-owned state. |
| Failed-run recovery | Run ended `blocked`, `rework`, malformed, scope-failed, verify-failed, stale, or otherwise untrusted. | Source run log, original task spec, failed command output, changed-file scope, lifecycle trajectory, recovery model. | Inspect learning statuses only after classifying the failure. `needs_more_evidence` and `manual_review` are common signals; none accept failed output. | Failure class, exact failed verification or scope evidence, original target/forbidden scope, recovery task proposal, and rerun or stop rationale. | Failed worker output is evidence, not trusted completion. Do not retry invisibly or accept unverified changes. | Stop if the failure cannot be classified or if recovery would broaden scope beyond the original trusted boundary. | Failed-run recovery playbook, recovery task spec, or lesson candidate only when repeated evidence supports it. |
| Learning / lesson promotion | Repeated evidence, `lessons:draft`, `lessons:review`, `lessons:review-inbox`, `lessons:promote`, or candidate promotion. | Lesson candidate, review records, promotion queue, source run evidence, proposed promoted artifact. | Inspect `promote_candidate`, `manual_review`, `needs_more_evidence`, and `reject_candidate` without treating any status as automatic guidance. | Candidate source evidence, review decision, target artifact rationale, verification evidence for promoted changes, and explicit promotion command when applicable. | Queue status activates review attention only. It is not doctrine, policy, playbook authority, or automatic promotion. | Stop before editing durable guidance unless the explicit review and promotion path authorizes the target artifact. | `references/lessons/reviews/index.json`, the specific review record, or the smallest promoted artifact after approval. |
| Correction transcript mining | BK provides a correction excerpt, review comment, or run evidence showing Samantha/Codex missed or overreached. | Explicit correction evidence, correction mining playbook, affected-layer artifacts as context, candidate classification. | Inspect candidate status only after a candidate exists. Before that, the correction is source evidence, not durable guidance. | Quoted or named correction evidence, candidate fields, classification, affected layer, and stop rationale separating mining from promotion. | Do not mine private transcripts broadly or infer unstated preferences from memory. | Stop before promotion, policy edits, resolver code, automation, dispatch, lifecycle mutation, or hidden memory. | `references/lessons/inbox/**` or review queue only when BK authorizes a candidate path. |
| AI-collaboration insight intake / stale constraint drift | External AI-collaboration source is being absorbed; BK identifies stale remembered constraints or slice-local non-goals reused as global doctrine. | Explicit source or correction evidence, drift review playbook, affected initiative, resolver route, canonical docs only when boundaries move. | Inspect review states for related lessons when they explain why a constraint was accepted, rejected, or needs more evidence. | Source excerpt or named evidence, stale-vs-current classification, affected route or artifact, applicability decision, and narrow follow-up if needed. | Older non-goals about dashboard, daemon/watch, or remote/control plane may be stale evidence; they are not automatic acceptance or automatic rejection. | Stop before implementing platform surfaces, automatic context loading, hidden memory, policy changes, or resolver behavior. | Drift review artifact, affected initiative, or a future route-map feedback note. |
| Batch planning | Multiple writer tasks, dependencies, write-set separation, serial-only files, integration order, stale-base behavior, or BatchSpec lifecycle. | BatchSpecs, parallelism boundary, dependency graph, write-set map, stale-base evidence, integration and cleanup records. | Inspect learning assets only for repeated batch failures or accepted batch lessons. Queue status cannot raise writer concurrency. | BatchSpec, dependency and write-set proof, serial-only file list, dispatch order, verification plan, partial-failure handling, and lifecycle evidence. | Parallel execution is separate from parallel trust. Writer concurrency does not increase by changing a value alone. | Stop if the task asks workers to coordinate, spawn agents, merge, rebase, clean up, mutate BatchSpecs, or raise concurrency without reviewed design. | `references/batch-specs/**` or a separate batch initiative, never worker-owned orchestration state. |
| Docs-only writer task | Target files are markdown only; executable code, tests, templates, profiles, run logs, package metadata, and runtime surfaces are out of scope. | Exact target markdown files, source principle or playbook, markdown diff check, declared target/forbidden scope. | Inspect promoted docs guidance only when it directly governs the target edit. Candidate statuses should not broaden target files. | Markdown diff, changed-file scope limited to target files, requested grep checks, `git diff --check`, and `HARNESS_RESULT` for worker output. | Docs-only authority does not allow resolver code, tests, task specs, run logs, lifecycle records, hidden memory, or platform surfaces. | Stop when the requested edit requires code, policy, templates, profiles, lessons, lifecycle mutation, or files outside declared target scope. | The edited markdown artifact; initiative brief update when the docs-only task is an initiative slice. |

## Future Slice Boundaries

Future slices may refine this playbook, but only inside their own declared
target scope:

- S2 Learning Asset Status may define the display and meaning of statuses such
  as `promote_candidate`, `manual_review`, `needs_more_evidence`, and
  `reject_candidate`. It must not promote guidance or change review policy.
- S3 Evidence Pack may define minimum evidence packs for common task families.
  It must keep route hints, run evidence, `HARNESS_RESULT`, verification, and
  lifecycle records in separate authority layers.
- S4 Applicability Gate may define the manual decision for stale, superseded,
  slice-local, or unrelated evidence. It must not add resolver code or automatic
  context loading.
- S5 Feedback Loop may define how verified route gaps or missing evidence
  categories become reviewable documentation updates. It must not add automatic
  promotion, hidden memory, policy rewrite, or worker authority expansion.

## Stop Rules

Stop and report the boundary issue when using this playbook would require:

- code, tests, task specs, task templates, agent profiles, policy, run logs,
  lifecycle records, package files, or runtime behavior changes outside the
  current task scope;
- automatic loading, scanning, mining, promotion, rewriting, dispatch, commit,
  cleanup, merge, push, or lifecycle mutation;
- treating route hints, thread summaries, lesson candidates, review queue
  status, or failed worker output as trusted completion evidence;
- implementing dashboard, daemon/watch, remote/control plane, connector,
  operator UI, scheduled automation, budget governance, or multi-project
  orchestration surfaces.

## Verification

For docs-only updates to this playbook, run the markdown diff check specified by
the task. When this playbook is used during an initiative slice, also update the
initiative brief with changed files, verification intent or evidence, accepted
decisions, blockers, and the next ready slice.
