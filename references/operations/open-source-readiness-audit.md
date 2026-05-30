# Open Source Readiness Audit

Date: 2026-05-30
Status: report-only
Source initiative: `references/initiatives/open-source-readiness.md`

## Scope

This audit inspected public-readiness blockers for Samantha before an eventual
open-source release. It did not edit implementation files, create task specs,
dispatch workers, commit, merge, clean up worktrees, or mutate lifecycle state.

Inspected surfaces:

- top-level direction and operating docs: `README.md`, `NORTH_STAR.md`,
  `ARCHITECTURE.md`, `ROADMAP.md`, `AGENTS.md`, `WORK-RULES.md`,
  `OPERATING_GUIDE.md`, `OPERATING_GUIDE_KR.md`
- package and CLI surfaces: `package.json`, `src/cli.ts`, `src/commands/`,
  selected `src/core/` command-adjacent files
- public candidate artifacts under `references/`, including initiatives,
  playbooks, task templates, task specs, lessons, reviews, operations, hooks,
  launch agent templates, and agent profiles
- repository hygiene surfaces: `.gitignore`, tracked artifact counts, and
  open-source metadata files

Search signals used:

- private operator markers: `BK`, `BK's`, `BK-facing`
- local machine paths: `/Users/byung`, `byung`
- target-project names: `HaLucy`, `Haechi`, `Hermes`
- sensitive-surface hints: `secret`, `token`, `API_KEY`, `private`
- public UX blockers: package metadata, CLI command shape, demo path, license

## Executive Finding

Samantha is not ready for public release as-is.

The blocker is not core architecture. The blocker is packaging and public
boundary hygiene: top-level docs still describe Samantha as BK's personal
harness, package metadata is private, no first-run demo exists, no license or
contribution surface exists, and `references/` contains a mixture of reusable
product doctrine, personal dogfood evidence, target-project plans, local paths,
and historical run/task artifacts.

The highest-value next move is not string replacement. The next move is to split
the repository into public product surfaces and dogfood/private evidence
surfaces, then design a safe first-run demo contract.

## Release Blockers

| Category | Finding | Evidence | Public outcome | Classification |
| --- | --- | --- | --- | --- |
| private assumptions | Top-level product docs explicitly frame Samantha around BK's Codex work. | `README.md:7`, `README.md:101`, `README.md:107`, `README.md:130`; `NORTH_STAR.md`, `ROADMAP.md`, `ARCHITECTURE.md`, `WORK-RULES.md` also contain BK-centric language. | New users will read this as a personal automation repo, not a reusable harness. | generalize before publishing |
| private assumptions | Operating guides hard-code the local harness repo path. | `OPERATING_GUIDE_KR.md:92-94`, `OPERATING_GUIDE_KR.md:576-577`, `OPERATING_GUIDE.md` has the same shape. | A public user cannot copy examples without editing local machine paths. | generalize before publishing |
| first-run blockers | `package.json` is marked private and describes the package as personal. | `package.json:4`, `package.json:6` | Package-based one-command demo is blocked. | generalize before publishing |
| first-run blockers | No repo-level `LICENSE`, `CONTRIBUTING`, `CODE_OF_CONDUCT`, or `SECURITY` file exists. | `find` found only dependency metadata under `node_modules`, not project-owned files. | Public release lacks basic open-source governance and security reporting surface. | create before publishing |
| first-run blockers | README lists many commands but no safe first-run demo or fixture happy path. | `README.md:31-64`, `README.md:221+` command list | Users must understand internals before they can run the trust loop. | generalize before publishing |
| confusing public surfaces | `references/` contains 200 tracked files across lessons, operations, tasks, initiatives, playbooks, and profiles. | `git ls-files references/lessons references/operations references/tasks references/initiatives` returned `200`. | Public readers cannot tell product docs from dogfood evidence. | split before publishing |
| confusing public surfaces | Target-project artifacts are mixed into public-looking Samantha references. | `references/initiatives/haechi-ui-ux-improvement.md:1-12`, `references/lessons/inbox/2026-05-29-halucy-sam-l-routing-boundary.md:5-8` | Public repo leaks unrelated project context and distracts from Samantha's harness shape. | move to dogfood/private notes |
| private assumptions | Lesson candidates and playbooks include exact local paths and correction transcripts. | `references/lessons/inbox/2026-05-29-halucy-sam-l-routing-boundary.md:7-8`, `:34-49`; `references/playbooks/cli-core-command-with-tests.md` includes local run paths. | Useful dogfood evidence, but not suitable as default public docs. | move to dogfood/private notes |
| authority-risky docs | README exposes advanced batch and lifecycle commands before a demo trust loop. | `README.md` current CLI surface lists run, merge, accept, cleanup, reports, lessons, batches, and batch-plans together. | New users may mistake advanced authority surfaces for the first thing to try. | reorganize before publishing |
| authority-risky docs | Existing report-only task template forbids all file creation, while this audit intentionally writes an operations report. | `references/task-templates/report-only-review.json` says no files should change. | Public workflow needs a clearer distinction between external report-only worker tasks and Samantha-owned report artifacts. | clarify before publishing |
| demo prerequisites | There is no neutral fixture repository or fixture task that demonstrates the full loop. | Existing fixtures are internal task specs and dogfood reports, not a public demo contract. | One-command first-run cannot be meaningful yet. | create before publishing |
| demo prerequisites | CLI has many command parsers but no obvious `demo`, `init`, or `doctor` entrypoint. | `src/cli.ts` command surface includes `run-task`, `runs:*`, `lessons:*`, `batches:*`, `batch-plans:*`, `continuation:*`; no demo/init/doctor surface was found. | A new user has no guided path and no environment diagnosis. | design before implementation |

## Category Notes

### Private Assumptions

The core private assumptions are visible enough that they should be fixed
before any public announcement:

- `BK` is used as the product's primary operator in top-level docs.
- `/Users/byung/Documents/samantha` appears in operating guides and reference
  artifacts.
- Target repo names and histories such as HaLucy, Haechi, Hermes, Apps in Toss,
  and Toss submission readiness appear inside public-looking `references/`.
- Lesson candidates quote live correction transcripts. These are valuable
  evidence for Samantha's learning loop, but they should not be published as
  ordinary docs without review.

Recommended outcome:

- Public docs should use neutral terms such as `user`, `operator`, or `local
  developer`.
- Dogfood evidence should either move to a non-public path or stay in a clearly
  labeled `dogfood/` archive that is excluded from the first public package.
- If any real dogfood artifact is kept public, redact local paths and explain
  that it is historical evidence, not product configuration.

### Confusing Public Surfaces

The repo currently has strong internal evidence discipline, but that discipline
is too exposed for a new public reader. `references/` is doing too many jobs:

- source-of-truth product doctrine
- active initiative plans
- task templates
- agent profiles
- private dogfood evidence
- lessons and lesson reviews
- operation reports
- historical worker task specs
- target-project context

Recommended outcome:

- Define a public artifact map before rewriting docs.
- Keep public-first surfaces small:
  - `README.md`
  - `docs/architecture.md` or equivalent public architecture page
  - `examples/demo-*`
  - `references/task-templates/` only if templates are safe and generic
  - `references/agent-profiles/` only if profiles are safe and generic
- Move or label historical dogfood evidence separately.

### First-Run Blockers

The first-run blocker is decisive. The repo cannot gather meaningful workflow
feedback until a user can run the trust loop locally.

Required first-run contract:

```text
install or clone
-> run one demo command
-> demo creates or opens a fixture repo
-> Samantha dispatches one bounded writer task
-> worker emits HARNESS_RESULT
-> deterministic verification runs
-> user can inspect run log/report
-> cleanup instructions are explicit
```

The first version can be `git clone` plus a single documented command. It does
not need Homebrew or a curl installer yet. It does need a safe fixture and a
clear failure path.

Recommended follow-up:

- Design the demo contract before writing code.
- Add `doctor` only if S2 finds environment diagnosis would materially reduce
  first-run failures. Do not expand the CLI surface speculatively.

### Authority-Risky Docs

The public docs need to preserve the same trust model but reduce accidental
authority impressions.

Risks:

- Listing `runs:accept`, `worktree:cleanup`, `batches:execute`, and
  `batch-plans:*` before a first-run demo makes the product feel like a broad
  operational framework.
- Public users may assume report-only review can write files or mutate repo
  state because this audit report is a written artifact. The distinction should
  be: worker report-only tasks do not mutate target work; Samantha-owned
  operator reports may be explicit repository artifacts when requested.
- LaunchAgent and daily lesson automation artifacts should not be part of the
  first public path unless they are clearly marked dogfood-only. They imply
  background operation, which the open-source readiness initiative excludes.

Recommended outcome:

- README should start with the trust loop and demo.
- Advanced lifecycle, batch, lesson promotion, and automation surfaces should
  move below an "Advanced / dogfood surfaces" section or separate docs.
- Keep non-goals visible near the demo: no remote operation, no background
  daemon, no writer parallelism, no hidden memory.

### Demo Prerequisites

Minimum demo prerequisites:

- fixture repo with harmless source and tests
- fixture task spec with target files, forbidden changes, verify commands, and
  expected commit subject
- public-safe agent profile or mock/sandbox mode decision
- deterministic verification command that works in a clean environment
- predictable run log location outside the user's real project
- cleanup story for generated worktrees and run logs
- clear expected output, including the `HARNESS_RESULT` line and where to inspect
  the report
- one intentionally failing path or doctor message so users can report first-run
  failures with useful detail

Open decision before implementation:

- Should the first demo call a real Codex worker, or should it have a dry-run /
  fixture-output mode first?

Recommendation: the public demo should ultimately call the real worker because
the trust loop is the product. If a mock mode is added, it should be labeled as
documentation smoke test only, not as proof of harness behavior.

## Proposed Follow-Up Slices

These are candidates only. They are not task specs and do not authorize
implementation.

| Slice | Type | Goal | Suggested output |
| --- | --- | --- | --- |
| S2 | brainstorm/plan | First-run demo contract | `references/operations/open-source-first-run-demo-brief.md` |
| S3a | docs-only | Public artifact map and dogfood/private split policy | `references/operations/open-source-artifact-map.md` or an initiative update |
| S3b | docs-only | Public README rewrite around trust loop and demo path | `README.md` plus public docs |
| S4a | implementation | Add fixture repo/task and one-command demo path after S2 acceptance | demo command, fixtures, tests |
| S4b | implementation | Add environment `doctor` only if S2/S4a evidence justifies it | CLI command plus focused tests |
| S5 | docs-only | Feedback intake templates | issue/discussion templates and release notes |

## Recommended Next Prompt

```text
sam p: Samantha open-source first-run demo contract를 설계해주세요.
Context: 기준 문서는 references/initiatives/open-source-readiness.md 이고, 감사 보고서는 references/operations/open-source-readiness-audit.md 입니다.
Ask: 공개 첫 버전에서 사용자가 실행할 one-command demo의 fixture repo, demo command, expected output, safe failure path, cleanup behavior, and authority boundaries를 decision-complete brief로 정리해주세요.
Scope: 아직 구현하지 않습니다. demo/init/doctor CLI 추가 여부도 결정만 합니다. task spec 생성, worker dispatch, commit은 하지 않습니다.
Output: references/operations/open-source-first-run-demo-brief.md
Stop: 실제 Codex worker 호출 여부, package runner 방식, fixture 위치, cleanup 책임 중 결정이 필요하면 질문으로 멈추세요.
```

## Audit Verdict

Release readiness verdict: blocked.

Reason: public positioning is directionally sound, but the repo still exposes
private operator assumptions and lacks the first-run demo contract required by
`references/initiatives/open-source-readiness.md`.

Highest-value next action: design the first-run demo contract before editing
README or mechanically replacing `BK`.
