# Initiative: Open Source Readiness

Status: in progress
Source: BK and Codex planning discussion on 2026-05-30 about preparing
Samantha for eventual public release and feedback.
Last updated: 2026-05-31

## Goal

Prepare Samantha for a public open-source release without misrepresenting it as
a finished general-purpose agent framework.

The public shape should be:

```text
local user goal
-> Samantha CEO decomposition
-> task spec
-> isolated worktree
-> Codex worker
-> HARNESS_RESULT
-> deterministic verification
-> run log and local report
```

The first public version should let a new user run this trust loop locally with
a fixture or sample repository. The goal is not to import BK's entire personal
workflow into another user's machine. The goal is to make the core idea
touchable: worker output becomes trusted only after Samantha-owned boundaries,
verification, and evidence.

## Public Positioning

Samantha is a local development harness for making Codex work auditable before
it becomes trusted work.

Use this public framing:

```text
Samantha is not a more autonomous coding agent.
Samantha is a local harness for deciding when agent work is safe to accept.
```

The important distinction is authority. Workers can execute bounded tasks, but
Samantha owns task scope, worktree isolation, verification, run evidence,
commit/report, merge checks, cleanup, and lifecycle transitions.

## Accepted Decisions

- Public release is desirable, but not before private assumptions are separated
  from the reusable harness shape.
- The first release should be presented as an active dogfood experiment, not as
  a polished framework or SaaS-style product.
- A one-command first-run experience is required for meaningful external
  feedback. People need to run the trust loop before they can comment on the
  workflow.
- The first-run experience should demonstrate the core loop on fixtures or a
  sample repository, not on BK's private run history or personal projects.
- Documentation should explain why the harness is intentionally slower than a
  direct agent call: it buys auditability, scope control, verification, and
  lifecycle evidence.
- Public examples should use neutral user language instead of assuming BK as
  the operator.
- Public artifacts should preserve the authority model. Convenience work must
  not weaken isolated worktrees, scope checks, deterministic verification,
  `HARNESS_RESULT`, run logs, or Samantha-owned transitions.

## First-Run UX Requirement

The public release is not ready until a new user can run a guided local demo
without understanding the internal architecture first.

Target first-run flow:

```text
clone or install Samantha
-> run one setup or demo command
-> create or use a fixture repository
-> dispatch one bounded task
-> see HARNESS_RESULT
-> see verification output
-> inspect the generated run log/report
```

Acceptable first public forms, in order:

1. `git clone` plus one documented demo command.
2. Package-based one-command demo, for example through `bunx` or an equivalent
   local package runner.
3. Installer scripts or package-manager distribution only after early feedback
   proves the extra maintenance cost is worth it.

The demo must not require editing local personal paths, copying BK-specific
commands, or using private repository artifacts.

## Release Readiness Criteria

Open-source release is ready only when all of these are true:

- A new user can run the demo in a clean local environment.
- The demo uses fixture or sample data and cannot mutate the user's real
  repository by accident.
- The README explains the trust loop before listing advanced commands.
- Personal references, local paths, private run evidence, and BK-specific
  workflow assumptions are either removed, generalized, or clearly marked as
  dogfood notes.
- The public command surface has at least one happy path and one understandable
  failure path.
- Failure output tells the user what to fix next.
- The public docs distinguish current support from future directions such as
  remote operation, background scheduling, multi-project orchestration, and
  writer parallelism.
- The release has an issue or discussion template aimed at workflow feedback:
  where the gates felt too heavy, where they felt insufficient, and where the
  first-run experience broke.

## Non-Goals

- Do not present Samantha as a general autonomous coding agent framework.
- Do not promise one-click adoption for arbitrary real repositories in the
  first public release.
- Do not add remote execution, messaging integrations, background daemons,
  scheduled automation, dashboards, connector expansion, budget governance, or
  multi-project orchestration as part of this readiness initiative.
- Do not add parallel writer execution or increase `writerCap`.
- Do not hide personal preferences in memory or ship BK-specific operating
  assumptions as if they are universal defaults.
- Do not publish private run logs, private project history, secrets, machine
  paths, or personal workflow evidence.
- Do not weaken task specs, isolated worktrees, scope checks, verification,
  `HARNESS_RESULT`, run evidence, merge checks, cleanup gates, or
  Samantha-owned commit/report authority to make the demo feel smoother.

## Invariants

- Samantha owns trust transitions. Workers own only bounded task execution.
- Public convenience must preserve the same authority model as local dogfood.
- Learning remains explicit and reviewable through repository artifacts.
- First-run UX may hide internal complexity from the user, but it must not hide
  trust decisions from the harness.
- Public docs should make the current maturity level obvious: useful dogfood
  harness, not mature platform.

## Audit Scope

Before release, review these surfaces for private or confusing assumptions:

- Top-level docs: `README.md`, `NORTH_STAR.md`, `ARCHITECTURE.md`,
  `ROADMAP.md`, `AGENTS.md`, and operating guides.
- CLI help text, command names, error messages, and demo output.
- `references/initiatives/`, `references/playbooks/`, `references/tasks/`,
  `references/task-templates/`, and `references/agent-profiles/`.
- Lesson candidates, lesson reviews, run summaries, and operation reports.
- Any fixture, sample, screenshot, diagram, or social post that will be linked
  from the public README.

The audit should classify each item as:

```text
publish as-is
generalize before publishing
move to dogfood/private notes
remove from public release
```

## Slice Roadmap

| Slice | Status | Objective | Output | Verification |
| --- | --- | --- | --- | --- |
| S0 | completed | Create this initiative brief and lock the public readiness boundary. | `references/initiatives/open-source-readiness.md` | File exists, scope includes first-run UX, and non-goals preserve authority gates. |
| S1 | completed | Run a report-only public readiness audit. | `references/operations/open-source-readiness-audit.md` | Report cites inspected files and classifies blockers across private assumptions, confusing surfaces, first-run blockers, authority-risky docs, and demo prerequisites. |
| S2 | completed | Design the first-run demo contract. | `references/operations/open-source-first-run-demo-brief.md` | Brief fixes `demo:first-run`, disposable fixture behavior, expected output, safe failure paths, cleanup behavior, and preserved trust-loop gates. |
| S3 | in progress | Rewrite public-facing docs around the trust loop and demo path. | Public artifact map and README-rewrite prerequisite plan in `references/operations/open-source-artifact-map.md` and `references/operations/open-source-public-docs-plan.md`; later README rewrite remains separate. | Docs boundary exists before README rewrite, including dogfood-private split, public docs restructuring, and release-gating checklist. |
| S4 | completed | Implement or wire the one-command demo only after S2 is accepted. | `demo:first-run` command and fixture path accepted at commit `413991128f3f0718c05846d23c018a38c4c33c7f`; dogfood evidence in `references/operations/open-source-first-run-demo-dogfood.md`. | Dogfood report records `bun run samantha demo:first-run --runtime=codex-sdk`, `HARNESS_RESULT: pass`, deterministic verification pass, disposable fixture repo, candidate commit, and no merge into a real user repository. |
| S5 | in progress | Prepare feedback intake. | README prerequisite plan now defines feedback intake requirements; issue/discussion templates and release notes remain a later explicit slice. | Plan asks for environment, first-run result, gate friction, missing verification, and desired workflow shape before template implementation. |

## Current Next Slice

S3/S5 documentation boundary work is the current safe slice.

Recommended next prompt:

```text
sam c: Samantha open-source README rewrite 전 public docs boundary를 완료해주세요.
Context: S1 audit은 references/operations/open-source-readiness-audit.md, S2 demo contract는 references/operations/open-source-first-run-demo-brief.md, S4 dogfood evidence는 references/operations/open-source-first-run-demo-dogfood.md 입니다. Accepted demo commit은 413991128f3f0718c05846d23c018a38c4c33c7f 입니다.
Ask: references/operations/open-source-artifact-map.md 와 references/operations/open-source-public-docs-plan.md 를 기준으로 README rewrite에 필요한 공개/비공개 문서 경계를 확정하고, 남은 S3/S5 후속 task를 분리해주세요.
Scope: 이번 slice는 docs-only 입니다. README rewrite, package metadata, license/governance files, source/tests/examples, task templates, agent profiles, lessons, runs, dogfood evidence 이동/삭제는 하지 않습니다.
Output: 한국어 요약과 변경 파일 목록, 검증 결과. 문서 본문은 기존 repo 관례에 맞춰 English를 유지해도 됩니다.
Stop: public/private boundary가 파일 이동이나 삭제 없이는 결정되지 않으면 그 결정을 unresolved로 보고하고 멈추세요.
```

## Completion Rule

This initiative is ready for public release only after S1 through S5 either
complete with evidence or are explicitly rejected with a documented reason. Any
new public command surface, installer, or demo implementation must still go
through ordinary Samantha task specs, isolated worktrees, `HARNESS_RESULT`,
deterministic verification, and Samantha-owned commit/report gates.
