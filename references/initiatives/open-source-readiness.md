# Initiative: Open Source Readiness

Status: completed for public repository and Bun-first npm package readiness
Source: BK and Codex planning discussion on 2026-05-30 about preparing
Samantha for eventual public release and feedback.
Last updated: 2026-06-01

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
run the published Bun-first package or clone Samantha
-> run one setup or demo command
-> create or use a fixture repository
-> dispatch one bounded task
-> see HARNESS_RESULT
-> see verification output
-> inspect the generated run log/report
```

Supported first public forms:

1. Package-based Bun-first demo through `bunx @lbk0523/samantha demo:first-run`.
2. `git clone` plus `bun install --frozen-lockfile` and `bun run samantha
   demo:first-run`.

`npx`, `npm exec`, and Node-general CLI support are not claimed.

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
| S3 | completed | Rewrite public-facing docs around the trust loop and demo path. | Public artifact map and README-rewrite prerequisite plan in `references/operations/open-source-artifact-map.md` and `references/operations/open-source-public-docs-plan.md`; README rewrite accepted at commit `b059a2485fd17b051beb1b061c40bd64e86c4218`. | `README.md` now leads with `demo:first-run`, the trust loop, public maturity, feedback routing, and dogfood-private boundaries. |
| S4 | completed | Implement or wire the one-command demo only after S2 is accepted. | `demo:first-run` command and fixture path accepted at commit `413991128f3f0718c05846d23c018a38c4c33c7f`; dogfood evidence in `references/operations/open-source-first-run-demo-dogfood.md`. | Dogfood report records `bun run samantha demo:first-run --runtime=codex-sdk`, `HARNESS_RESULT: pass`, deterministic verification pass, disposable fixture repo, candidate commit, and no merge into a real user repository. |
| S5 | completed | Prepare feedback intake. | `.github/ISSUE_TEMPLATE/first-run-demo.yml`, `.github/ISSUE_TEMPLATE/workflow-feedback.yml`, and `references/operations/open-source-release-note-draft.md` accepted at commit `b059a2485fd17b051beb1b061c40bd64e86c4218`. | Feedback intake asks for environment, `demo:first-run` command, stage, run log, `HARNESS_RESULT`, verification evidence, cleanup status, gate friction, and expectations. |
| S6 | completed | Close governance/package readiness before package publication. | Governance files accepted at commit `17d6349`; package metadata and package contents hygiene recorded in `references/operations/open-source-package-readiness-final-pass.md`; checklist updated in `references/operations/open-source-public-release-checklist.md` and `references/operations/open-source-governance-package-readiness.md`. | `package.json` has public-facing package metadata, `license: MIT`, Bun engine metadata, and a conservative `files` array; package dry-run verified package contents exclude dogfood/private surfaces including `references/thread-control/**`. |
| S7 | completed | Close npm publication docs after `@lbk0523/samantha@0.1.0` publication and Bun-first package-runner dogfood. | `references/operations/open-source-npm-publication-closeout.md` records operator preflight publication evidence and package-runner dogfood evidence. | GitHub repository is public; npm package is public as `@lbk0523/samantha@0.1.0`; `npm pack` dry-run returned the expected public package contents; `bunx @lbk0523/samantha demo:first-run --runtime=codex-sdk` dogfood passed with `HARNESS_RESULT: pass` and verification pass. |

## Current Release State

S1 through S7 are complete for the first public release path. The primary
supported public entry is:

```bash
bunx @lbk0523/samantha demo:first-run
```

Clone-based local development remains supported with:

```bash
bun install --frozen-lockfile
bun run samantha demo:first-run
```

The npm package is public as `@lbk0523/samantha@0.1.0`. The supported
package-runner posture is Bun-first only. Do not claim `npx`, `npm exec`, or
Node-general CLI support until a later task explicitly implements and verifies
that contract.

Recommended next prompt after this slice:

```text
sam p: Samantha 공개 패키지 후속 피드백 경로를 점검해주세요.
Context: S1-S7는 완료되었습니다. GitHub repository는 public이고 npm package는 @lbk0523/samantha@0.1.0 public package입니다. Bun-first package-runner dogfood는 references/operations/open-source-npm-publication-closeout.md에 기록되어 있습니다.
Ask: 첫 외부 사용자 피드백 수집 경로와 release note 사용 여부를 점검해주세요.
Scope: report-only release follow-up review 입니다. npx/npm exec/Node-general CLI 지원, source/test/example 변경, package metadata 변경, references 이동/삭제는 하지 않습니다.
Output: 한국어 후속 운영 요약, 남은 blocker, 다음 Samantha task 또는 stop decision.
Stop: 새 command surface나 package-runner 지원 확대가 필요하면 별도 task spec으로 멈추세요.
```

## Completion Rule

This initiative is public-package ready after S1 through S7 complete with
evidence. Any new public command surface, installer, `npx`/`npm exec` support,
Node-general CLI support, artifact movement, governance file change, or demo
implementation must still go through ordinary Samantha task specs, isolated
worktrees, `HARNESS_RESULT`, deterministic verification, and Samantha-owned
commit/report gates.
