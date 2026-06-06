# Samantha Harness Rules

## Workspace Policy Inheritance

This repo lives under `/Users/byung/agent-workspace` and inherits the workspace
startup contract at `/Users/byung/agent-workspace/AGENTS.md`.

The workspace policy never weakens Samantha-specific gates in this file. If the
rules conflict, follow the stricter Samantha authority boundary.

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

## Codex-Initiated Samantha Invocation

Samantha is normally activated by BK through explicit `Samantha <intent>:` or
`sam <alias>:` language. Codex may also enter Samantha as an operator proxy when
a workspace `AGENTS.md`, repo `AGENTS.md`, or other reviewed startup policy has
already classified the user's request as Samantha-required.

Policy-triggered invocation is not a sticky Samantha session, background
operation, project-global default, or permission for Codex Desktop to implement
directly. It is only an entrypoint into the same Samantha-owned lifecycle:
task spec, isolated worktree, worker run, `HARNESS_RESULT`, deterministic
verification, and Samantha-owned commit/report.

When Codex invokes Samantha on BK's behalf, it must report the target repo,
harness repo, task spec or task-spec decision, run evidence, changed-file scope,
verification results, and any missing gate. Codex Goal mode, subagents, manual
thread control, or worker prose remain advisory surfaces and do not satisfy
Samantha evidence requirements.

Use `references/playbooks/codex-initiated-samantha-invocation.md` for the
preflight, dispatch, and reporting checklist.

## Self-Build Implementation Gate

Inside the Samantha repo, Codex Desktop must not directly edit implementation
files for Samantha self-build writer work when any condition applies:

- the request is invoked through `Samantha command:` or `sam c:`
- a sticky follow-up is classified as decision-complete implementation work
- workspace policy, repo policy, or the Samantha gate classifies the request as
  Samantha-required decision-complete writer implementation

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
- `OPERATING_GUIDE_KR.md` for BK-facing Samantha intent and handoff protocol
- `WORK-RULES.md` for Codex/Samantha working discipline and completion checks

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
