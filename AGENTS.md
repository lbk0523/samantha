# Samantha Harness Rules

## Product Boundary

Samantha is a CEO-style local development harness for BK's Codex software work.

Before recommending execution, classify the request as one of:

- doctrine / product boundary / architecture / roadmap work
- decision-complete implementation work
- report-only review
- recovery / lifecycle action

Doctrine, architecture, and roadmap work stays in CEO/architect mode. Propose
phases, artifacts, assumptions, decision points, validation boundaries, and stop
conditions before implementation.

Once work becomes executable, it must move through Samantha-owned artifacts and
lifecycle records:

```text
minimal user goal
-> Samantha CEO decomposition
-> task spec
-> isolated worktree
-> Samantha worker run
-> HARNESS_RESULT
-> deterministic verification
-> Samantha-owned commit/report
```

## Self-Build Implementation Gate

Inside the Samantha repo, Codex Desktop must not directly edit implementation
files for Samantha self-build writer work when either condition applies:

- the request is invoked through `Samantha command:` or `sam c:`
- a sticky follow-up is classified as decision-complete implementation work

Such work must be represented as a task spec, isolated worktree, SDK-backed
Samantha worker run using `--runtime=codex-sdk`, `HARNESS_RESULT`,
deterministic verification, and Samantha-owned commit/report.

Do not report self-build implementation as complete, committed, or pushed unless
run evidence exists. Equivalent evidence must include worker run logs,
`HARNESS_RESULT`, changed-file scope, and verification results.

## Direction Documents

Read these before broad architectural or roadmap changes:

- `NORTH_STAR.md`
- `ARCHITECTURE.md`
- `ROADMAP.md`

## Work Rules

`WORK-RULES.md` is the source of truth for working discipline in this repo.

Keep this file focused on product boundaries, authority boundaries, and hard
gates. Add ordinary work-discipline rules to `WORK-RULES.md`.

Before implementing Samantha self-build work, apply the relevant sections of
`WORK-RULES.md`. Before final response, apply its completion checklist.

## Learning

Samantha may learn only through explicit, reviewable repository artifacts such
as direction docs, playbooks, task templates, agent profiles, policy checks, run
summaries, and lifecycle records.

Do not add hidden memory or silently rewrite doctrine/policy. If a lesson should
affect future behavior, write it as a candidate artifact or reviewed policy/test
change.

## Parallelism

Single-writer execution is the MVP constraint. Do not raise writer concurrency
by changing `writerCap` alone.

Workers must not spawn, coordinate, or delegate to subagents. Samantha owns
orchestration.

Parallel writer batches require a reviewed batch design before implementation.
Report-only worker parallelism is allowed only when explicitly orchestrated and
non-writer.

## Meta-Tasks

Changes to Samantha's authority model are meta-tasks, not ordinary
implementation chores.

Treat changes to `AGENTS.md`, direction docs, policy code, task templates, agent
profiles, and authority-bearing contracts as doctrine or policy work.

Doctrine updates should stay documentation-only unless enforcement is explicitly
requested. Policy changes require focused tests proving the intended
accept/reject behavior. If a change moves authority boundaries, use a
report-only review before making it routine.
