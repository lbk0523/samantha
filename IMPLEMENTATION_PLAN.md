# Implementation Plan

Last updated: 2026-05-13

This document tracks current Samantha harness work after migration. It is not a
zero-base repo-start prompt.

## Completed Bootstrap

The harness has already crossed the initial bootstrap line:

- package, TypeScript config, and test runner exist
- task and agent contracts exist
- writer and non-writer policy checks exist
- Codex dispatch prompt and command construction exist
- per-task worktree allocation exists
- worker `HARNESS_RESULT` parsing exists
- scope and forbidden-change evaluation exist
- verify commands run outside the worker's judgment
- run logs and run index exist
- merge check, accept, cleanup, diagnose, lesson draft, and task generation
  commands exist
- worker and report-only reviewer profiles exist
- initial task templates exist

## Current Operating Baseline

The normal executable loop is:

```text
task spec
-> isolated worktree
-> Codex run
-> HARNESS_RESULT
-> deterministic scope and verification evaluation
-> Samantha-owned commit/report
-> explicit post-run merge, acceptance, cleanup, diagnosis, or follow-up task
```

Core verification for code changes remains:

```bash
bun run typecheck
bun test
```

Docs-only tasks may use cheaper deterministic checks when the changed surface is
only markdown, but the verify command still needs to match the task risk.

## Near-Term Work

The next useful slices are:

1. Dogfood report-only review tasks against real Samantha run evidence.
2. Use `runs:diagnose` and `tasks:from-run` on failed or blocked runs to produce
   narrower follow-up task specs.
3. Improve task templates only after repeated usage shows a real pattern.
4. Keep learning artifacts reviewable: lesson candidates first, promotion later.
5. Treat adjacent surfaces such as chat adapters, daemon operation, dashboards,
   budgets, and multi-project orchestration as separate product slices with
   explicit authority and verification design.

## Planning Rule

Future implementation plans should start from current repo evidence, not from
the completed `samantha-codex` migration. If a historical idea is useful, restate
it as a current Samantha task with target files, forbidden changes, and verify
commands.
