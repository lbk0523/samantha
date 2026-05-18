# Playbook: Correction Transcript Mining

## Purpose

Use this playbook to collect BK correction signals from explicit session
excerpts and Samantha run evidence, then shape them into reviewable learning
candidates.

Correction mining is an evidence collection step. It does not change Samantha's
behavior by itself. It creates candidates that BK can review before any
playbook, `WORK-RULES.md`, task template, agent profile, policy, or direction
document is promoted.

## When To Use

Use this playbook when BK or Samantha has an explicit correction signal such as:

- a pasted session excerpt where BK corrected Codex or Samantha behavior;
- a Samantha run report showing a worker missed, overreached, or violated an
  instruction;
- a repeated `HARNESS_RESULT` rework or blocked pattern with enough run
  evidence to describe the correction precisely;
- a reviewed follow-up asking whether a correction should become a candidate
  repository artifact.

Do not use this playbook to hunt through private chat history, infer hidden
preferences, or promote a correction directly into durable guidance.

## Allowed Evidence Sources

Use only evidence that is explicit and reviewable:

- session excerpts BK pasted or specifically pointed to;
- Samantha run logs, worker reports, scope-check output, verify output, and
  lifecycle records;
- existing repository artifacts needed to understand the affected layer, such
  as playbooks, `WORK-RULES.md`, task templates, agent profiles, policy files,
  direction documents, lesson candidates, and lesson reviews;
- BK's direct review comments on a candidate.

Quote only the minimum excerpt needed to preserve the correction. Summarize
long evidence and keep source references precise enough that a reviewer can
audit the claim.

## Required Candidate Fields

Every correction candidate must include:

- `candidate_id`: stable date-and-slug identifier.
- `source_type`: `session_excerpt`, `run_evidence`, or `review_comment`.
- `source_reference`: exact session label, run id, file path, or review record.
- `excerpt_or_evidence`: minimal quoted excerpt or concise evidence summary.
- `correction_signal`: what BK corrected or what the run evidence proved.
- `classification`: one category from this playbook.
- `affected_layer`: the artifact family that might change if promoted.
- `proposed_change`: candidate guidance, not an applied edit.
- `why_it_matters`: failure mode the correction prevents.
- `promotion_risk`: how premature or wrong promotion could harm Samantha.
- `review_question`: the specific BK decision needed before promotion.
- `status`: `candidate`, `needs_more_evidence`, or `rejected`.

If any field cannot be filled from allowed evidence, mark the candidate
`needs_more_evidence` instead of inventing context.

## Classification Categories

Use one primary category:

- `communication-discipline`: correction about how Codex or Samantha should
  explain, challenge, ask, or report.
- `scope-control`: correction about avoiding unrelated edits, overbuilding, or
  touching forbidden files.
- `authority-boundary`: correction about commits, worktrees, dispatch,
  lifecycle, cleanup, merge, push, or policy authority.
- `verification-gap`: correction about missing, weak, skipped, or misleading
  verification.
- `artifact-shape`: correction about candidate, playbook, template, agent
  profile, report, or direction-document structure.
- `routing-intent`: correction about when work belongs in brainstorm, plan,
  command, review, recovery, or report-only mode.
- `promotion-criteria`: correction about evidence thresholds for turning a
  candidate into durable guidance.
- `non-actionable`: signal is too vague, private, contradictory, or one-off to
  preserve as a candidate.

Do not average categories. If two categories are plausible, choose the one that
would own the first review decision and mention the secondary category in
`why_it_matters`.

## Procedure

1. Confirm the evidence source is allowed and explicit.
2. Extract the smallest correction signal that survives without hidden context.
3. Identify the affected layer without editing that layer.
4. Classify the candidate and fill every required field.
5. State the narrowest proposed change that could prevent recurrence.
6. Mark the candidate status.
7. Stop before promotion. Promotion is a separate BK-reviewed action.

Prefer one precise candidate over a broad bundle. Split candidates when the
same excerpt implies different affected layers or different review questions.

## Review And Promotion Flow

Correction mining may produce a report-only candidate or a candidate markdown
artifact when the task explicitly authorizes that output. The candidate remains
advisory unless a separate BK-reviewed promotion task accepts it.

The preserved learning loop is:

```text
explicit correction evidence
-> correction candidate
-> BK review
-> promoted artifact, if approved
-> later run evidence
```

BK review is required before any correction is promoted into:

- playbooks;
- `WORK-RULES.md`;
- task templates;
- agent profiles;
- TypeScript policy checks;
- direction documents such as `AGENTS.md`, `NORTH_STAR.md`,
  `ARCHITECTURE.md`, or `ROADMAP.md`.

Promotion should use the smallest artifact layer that fits the correction.
Advisory behavior belongs in playbooks. Default worker behavior belongs in task
instructions, templates, or agent profiles. Trust gates belong in policy code
with focused tests. Doctrine belongs in direction documents only when the
authority model changes.

## Authority Limits

This playbook authorizes judgment and drafting only. It does not authorize:

- changing promoted artifacts during mining;
- changing worker instructions for an active run;
- creating task specs, worktrees, run logs, commits, or lifecycle records;
- adding resolver code, CLI commands, policy checks, tests, or automation;
- granting workers merge, push, cleanup, dispatch, or promotion authority;
- storing corrections in hidden memory.

If a correction appears to require an authority change, record that as the
review question and stop.

## Forbidden Automatic Behavior

Do not:

- scan full transcripts automatically;
- watch chats, logs, directories, or run streams for correction signals;
- create routine triggers, daemon behavior, dashboards, remote adapters, or
  notification workflows;
- infer BK preferences from unstated context;
- draft candidates from private or unavailable evidence;
- promote candidates automatically;
- edit playbooks, `WORK-RULES.md`, task templates, agent profiles, policy, or
  direction documents as part of mining;
- change verification, scope, commit, push, cleanup, or lifecycle behavior.

## Verification Expectations

A correction mining result is verified by reviewability, not by runtime tests.
Before closing a mining task, check that:

- every source is allowed and named;
- every candidate has all required fields;
- quoted evidence is minimal and auditable;
- proposed changes are candidates only;
- no promoted artifact was edited unless the task separately authorized that
  exact file;
- no automatic scan, promotion, hidden memory, runtime code, CLI surface, task
  template, agent profile, run log, worktree, or dashboard was created.

For docs-only edits to this playbook or candidate markdown, run the markdown
diff check specified by the task.

## Stop Conditions

Stop and report the reason when:

- no explicit session excerpt, run evidence, or review comment is available;
- the source requires automatic transcript scanning;
- the correction depends on private context that cannot be cited;
- the candidate would contain secrets, credentials, or private account state;
- the proposed fix would directly change authority boundaries without BK
  review;
- the evidence points to contradictory corrections that need BK judgment;
- the task asks mining to promote, enforce, dispatch, commit, push, clean up, or
  run background automation.

## Output Shape

Use this shape for each candidate:

```markdown
## Correction Candidate: <candidate_id>

- Source type:
- Source reference:
- Excerpt or evidence:
- Correction signal:
- Classification:
- Affected layer:
- Proposed change:
- Why it matters:
- Promotion risk:
- Review question:
- Status:
```

End a mining report with one of these outcomes:

- `candidates-ready-for-review`: candidates are complete and await BK review.
- `needs-more-evidence`: allowed evidence is insufficient.
- `rejected-as-non-actionable`: evidence does not justify a candidate.
- `blocked-by-authority`: requested action would bypass the learning loop.
