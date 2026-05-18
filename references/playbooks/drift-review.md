# Drift Review

## Purpose

Drift Review is a one-shot, report-only review surface for checking whether a
Samantha plan, task, run, or artifact has drifted from an accepted goal,
authority boundary, or evidence trail. It produces advice for BK or Samantha; it
does not create tasks, mutate lifecycle state, or make implementation trusted.

## When To Invoke

Use this playbook when:

- a task, plan, or run appears to have moved beyond its accepted scope
- a follow-up needs a quick check against direction docs, task specs, or run
  evidence before more work is dispatched
- a report-only reviewer can cite enough local evidence to classify the drift
- Samantha needs exactly one recommended next action, not automatic execution

Do not use it as a daemon, watcher, routine trigger, dashboard, transcript
collector, or automatic task creator.

## Evidence Whitelist

The reviewer may cite only evidence supplied by Samantha or already present in
the local repository:

- direction docs such as `AGENTS.md`, `NORTH_STAR.md`, `ARCHITECTURE.md`,
  `ROADMAP.md`, and `WORK-RULES.md`
- task specs, task templates, agent profiles, and playbooks
- run logs, lifecycle records, command output, and verification output
- local git diff, status, and file contents inside the assigned repository
- explicit BK or Samantha instructions included in the current task context

## Forbidden Evidence

The report must not rely on:

- hidden memory or unstated model recollection
- uncited conversation fragments outside the provided task context
- automatic transcript capture or background monitoring
- remote adapters, Telegram, daemon/watch services, dashboards, routine
  triggers, CEO-office memory, budget governance, or multi-project state
- assumptions that cannot be tied to a whitelisted evidence item

## Output Shape

Return a concise report with this shape:

```text
Outcome: no_drift | possible_drift | confirmed_drift | blocked
Drift category: scope | authority | lifecycle | evidence | verification | product_boundary | none
Cited evidence:
- <file, run id, command, or task-context citation>: <what it proves>
Next action: <exactly one advice-only action>
```

Use `blocked` when the whitelist lacks enough evidence to classify the review.
Use `none` only with `Outcome: no_drift`.

The next action must be exactly one action. It may recommend accepting the
current direction, asking BK for a decision, drafting a bounded task spec,
running a deterministic verification command, or stopping the work. It must not
perform the action.

## Trust Gates

- Output is advice-only evidence.
- Reviewer output does not authorize writes, commits, merges, cleanup, policy
  changes, lifecycle transitions, or follow-up task creation.
- Samantha owns any dispatch, verification, lifecycle, commit, merge, cleanup,
  or report acceptance decision.
- Any follow-up writer task still needs target files, forbidden changes,
  deterministic verification, run evidence, and Samantha-owned integration.

## Lifecycle Boundaries

Drift Review may inspect lifecycle evidence and recommend a next action, but it
must not change run status, accept or reject runs, supersede tasks, clean up
worktrees, create commits, push branches, promote lessons, or update policy.

## Stop Conditions

Stop and return `Outcome: blocked` when:

- no whitelisted evidence is available for the requested drift question
- the request requires forbidden evidence or background monitoring
- classification would require changing policy, doctrine, lifecycle state, or
  runtime behavior
- the reviewer cannot cite evidence for the outcome and next action

## MVP Exclusions

Drift Review Slice A excludes Telegram, remote adapters, daemon/watch services,
dashboards, CEO-office memory, routines, budget governance, multi-project
orchestration, schema or summarizer code, CLI commands, resolver behavior,
automatic transcript capture, automatic task creation, lifecycle mutation,
policy changes, agent profile changes, run log generation, hidden memory,
Correction Mining promotion, and broad refactors.
